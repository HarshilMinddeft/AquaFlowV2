import * as algokit from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConnectWallet from './components/ConnectWallet'
import Nav from './components/Nav'
import Transact from './components/Transact'
import { AquaFlowV2Client } from './contracts/AquaFlowV2'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

interface AccountHistoryProps {}
interface StreamData {
  streamId: number
  recipient: string
  streamCreator: string
  balance: number
  flowRate: number
  startTime: string
  endTime: string
  withdrawnAmount: number
  isStreaming: boolean
}

const AccountHistory: React.FC<AccountHistoryProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [openDemoModal, setOpenDemoModal] = useState<boolean>(false)
  const [appId, setAppId] = useState<number>(729020888)
  const [streamData, setStreamData] = useState<StreamData[]>([])
  const { activeAddress, signer } = useWallet()
  const [userAccountBalance, setUserAccountBalance] = useState<number>()
  const navigate = useNavigate()

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const algorand = algokit.AlgorandClient.fromConfig({ algodConfig })
  algorand.setDefaultSigner(signer)

  const userBalanceFetch = async () => {
    try {
      const dmClient = new AquaFlowV2Client(
        {
          resolveBy: 'id',
          id: appId,
          sender: { addr: activeAddress!, signer },
        },
        algorand.client.algod,
      )
      dmClient

      const accountInfo = await algorand.client.algod.accountInformation(activeAddress!).do()
      const userBalance = accountInfo.amount

      setUserAccountBalance(userBalance / 1e6)
    } catch (error) {
      console.error('Error fetching user balance:', error)
    }
  }
  async function listBoxes() {
    try {
      const boxList = await algorand.client.algod.getApplicationBoxes(appId).do()
      // Convert each box name from Uint8Array to integer
      const decodedBoxNumbers = boxList.boxes.map((boxDescriptor) => {
        const boxNameArray = boxDescriptor.name
        // Decode the Uint8Array into a single integer (assuming it's a big-endian 8-byte integer)
        let boxNumber = 0
        for (let i = 0; i < boxNameArray.length; i++) {
          boxNumber = (boxNumber << 8) | boxNameArray[i]
        }
        return boxNumber
      })

      const allStreamData: StreamData[] = []

      for (const streamId of decodedBoxNumbers) {
        const streamIdArray = new Uint8Array(8)
        new DataView(streamIdArray.buffer).setUint32(4, Number(streamId))

        const boxValueResponse = await algorand.client.algod.getApplicationBoxByName(appId, streamIdArray).do()
        const boxvalues = new DataView(boxValueResponse.value.buffer)

        const rate = Number(boxvalues.getBigUint64(0, false))
        const startTime = Number(boxvalues.getBigUint64(8, false))
        const endTime = Number(boxvalues.getBigUint64(16, false))
        const withdrawnAmount = Number(boxvalues.getBigUint64(24, false))
        const recipient = algosdk.encodeAddress(new Uint8Array(boxValueResponse.value.slice(32, 64)))
        const streamCreator = algosdk.encodeAddress(new Uint8Array(boxValueResponse.value.slice(64, 96)))
        const balance = Number(boxvalues.getBigUint64(96, false)) / 1e6
        const isStreaming = boxvalues.getUint8(104) !== 0

        const formattedStartTime = dayjs.unix(startTime).format('MM/DD/YYYY, h:mm:ss A')
        const formattedEndTime = dayjs.unix(endTime).format('MM/DD/YYYY, h:mm:ss A')

        if (streamCreator == activeAddress || recipient == activeAddress) {
          allStreamData.push({
            streamId,
            recipient,
            streamCreator,
            balance,
            flowRate: rate / 1e6,
            startTime: formattedStartTime,
            endTime: formattedEndTime,
            withdrawnAmount: withdrawnAmount / 1e6,
            isStreaming,
          })
        }
      }

      setStreamData(allStreamData)
      return decodedBoxNumbers
    } catch (error) {
      console.error('Error listing boxes:', error)
      throw error
    }
  }

  useEffect(() => {
    if (activeAddress) {
      userBalanceFetch()
      listBoxes()
    }
  }, [activeAddress])

  return (
    <div className="min-h-screen bg-custom-gradient">
      <center>
        <button
          data-test-id="connect-wallet"
          className="btn px-5 bg-purple-700 z-10 mt-2 right-2 hover:bg-purple-800 text-white pb-3 pt-2 text-xl rounded-2xl absolute "
          onClick={toggleWalletModal}
        >
          {!activeAddress ? 'Connect Wallet' : activeAddress && `Balance ${userAccountBalance} algos`}
        </button>
      </center>
      <div className="relative">
        <Nav />
      </div>
      <center>
        <div className="mt-16 max-w-7xl text-[21px]">
          {streamData.map((stream, index) => (
            <div
              key={index}
              className="backdrop-blur-[5px] mt-7 bg-[rgba(44,33,59,0.48)] p-4 rounded-2xl border-white border-solid border-2"
            >
              <table className="w-full border-3 text-gray-500 dark:text-gray-400">
                <tbody>
                  <tr className="border-solid flex border-b  border-slate-200 text-white font-medium mt-1">
                    <th className="text-white  font-medium mt-1">StreamID</th>
                    <td className="text-white ml-auto mt-2 mr-2">{stream.streamId}</td>
                  </tr>
                  <tr className="border-solid flex border-b border-slate-200">
                    <th className="text-white font-medium mt-1">Creator</th>
                    <td className="text-white mt-2 ml-auto">{stream.streamCreator}</td>
                  </tr>
                  <tr className="border-solid flex border-b border-slate-200">
                    <th className="text-white font-medium mt-1">Receiver</th>
                    <td className="text-white mt-2 ml-auto">
                      {stream.recipient == 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'
                        ? 'Stream Stopped By Creator'
                        : stream.recipient}
                    </td>
                  </tr>
                  <tr className="border-solid flex border-b border-slate-200">
                    <th className="text-white font-medium mt-2">Total Contract Balance</th>
                    <td className="text-red-400 ml-auto mt-2 mr-2">{stream.balance} Algos</td>
                  </tr>
                  <tr className="border-solid flex border-b border-slate-200">
                    <th className="text-white font-medium mt-2">Stream Start Time</th>
                    <td className="text-white ml-auto mt-2 mr-2">
                      {stream.startTime == '01/01/1970, 5:30:00 AM' ? '0' : stream.startTime}
                    </td>
                  </tr>
                  <tr className="border-solid flex border-b border-slate-200">
                    <th className="text-white font-medium mt-2">Stream Finish Time</th>
                    <td className="text-white ml-auto mt-2 mr-2">{stream.endTime == '01/01/1970, 5:30:00 AM' ? '0' : stream.endTime}</td>
                  </tr>
                  <tr className="border-solid flex border-b border-slate-200">
                    <th className="text-white font-medium mt-2">Algo Flow Rate</th>
                    <td className="text-white ml-auto mt-2 mr-2">{stream.flowRate} P/Sec Algos</td>
                  </tr>
                  <tr className="border-solid flex border-b border-slate-200">
                    <th className="text-white font-medium mt-2">Total Withdraw Amount</th>
                    <td className="text-green-500 ml-auto mt-2 mr-2">{stream.withdrawnAmount} Algos</td>
                  </tr>
                  <tr className="border-solid flex border-b border-slate-200">
                    <th className="text-white font-medium mt-2">Active Stream</th>
                    <td className="text-white ml-auto mt-2 mr-2">{stream.isStreaming ? 'Yes' : 'No'}</td>
                  </tr>
                  {!stream.isStreaming && (
                    <tr className="border-solid flex border-b border-slate-200">
                      <th className="text-white font-medium mt-4">StartStreamUsingThisId</th>
                      <td className="ml-auto mt-2 mr-2">
                        <button
                          className="btn text-[21px] p-2 font-medium rounded-xl mt-1 mb-2 bg-purple-700 hover:bg-purple-800 text-white"
                          onClick={() => navigate('/RestartStream', { state: { streamId: stream.streamId } })}
                        >
                          RestartStream
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </center>

      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
      <Transact openModal={openDemoModal} setModalState={setOpenDemoModal} />
    </div>
  )
}

export default AccountHistory
