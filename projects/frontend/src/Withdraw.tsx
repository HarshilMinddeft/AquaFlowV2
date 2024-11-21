import * as algokit from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import AnimatedCounter from './components/AnimatedCounter'
import ConnectWallet from './components/ConnectWallet'
import BlinkBlurB from './components/Loders'
import Nav from './components/Nav'
import Transact from './components/Transact'
import { AquaFlowV2Client } from './contracts/AquaFlowV2'
import { withdraw } from './methods'
import useDebounce from './utils/hooks/useDebounce'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

interface WithdrawProps {}

const Withdraw: React.FC<WithdrawProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [openDemoModal, setOpenDemoModal] = useState<boolean>(false)
  const [appId, setAppId] = useState<number>(729020888)
  const { activeAddress, signer } = useWallet()
  const [isStreaming, setIsStreaming] = useState<number>(0)
  const [streamContractBalance, setStreamContractBalance] = useState<number>(0)
  const [streamStartTime, setStreamStartTime] = useState<string>()
  const [streamId, setStreamId] = useState<bigint>(0n)
  const debounceStreamId = useDebounce(streamId, 400)
  const [streamFinishTime, setStreamFinishTime] = useState<string>()
  const [streamFlowRate, setStreamFlowRate] = useState<number>(0)
  const [totalUserWithdraw, setTotalUserWithdraw] = useState<number>(0)
  const [reciverAddress, setReciverAddress] = useState<string>()
  const [creatorDAddress, setcreatorDAddress] = useState<string>()
  const [epochStreamStartTime, setepochStreamStartTime] = useState<number>(0)
  const [animationDuration, setAnimationDuration] = useState<number>(0)
  const [userAccountBalance, setUserAccountBalance] = useState<number>()
  const [epochStreamfinishTime, setepochStreamfinishTime] = useState<number>(0)
  const [finalDisplayAmount, setFinalDisplayAmount] = useState<number>(0)

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
    userBalanceFetch()
  }

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const algorand = algokit.AlgorandClient.fromConfig({ algodConfig })
  algorand.setDefaultSigner(signer)

  const dmClient = new AquaFlowV2Client(
    {
      resolveBy: 'id',
      id: appId,
      sender: { addr: activeAddress!, signer },
    },

    algorand.client.algod,
  )

  const handleStreamIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const inputAppId = Number(event.target.value)
      setStreamId(BigInt(inputAppId))
    } catch (error: any) {
      if (error instanceof Error) {
        if (error.message.includes('404')) {
          // If a 404 error occurs (application not found), show an error message
          toast.error('Stream ID does not exist. Please enter a valid Stream ID.')
        } else {
          console.error('An error occurred while fetching the app ID:', error.message)
          toast.error('Failed to validate Stream ID. Please try again.')
        }
      }
    }
  }

  const handleWithdraw = async () => {
    if (activeAddress) {
      try {
        const withdrawConf = await withdraw(algorand, dmClient, activeAddress, appId, streamId)()
        if (withdrawConf?.success) {
          toast.success('Withdraw success')
        }
        await userBalanceFetch()
        await fetchStreamBoxData()
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Rejected by user')) {
            console.error('Caught a user rejection error:', error.message)
            toast.error('Transaction rejected by user')
          } else {
            if (error.message.includes('opcodes=assert; ==; assert')) console.error('An error occurred during withdrawal:', error.message)
            toast.error('you are not allowed to withdraw')
          }
        } else {
          console.error('An unknown error occurred:', error)
          toast.error('An unknown error occurred')
        }
        console.error('Withdrawal failed', error)
      }
    }
  }

  //FIF
  const calculateAnimationDuration = () => {
    if (streamFlowRate > 0 && streamContractBalance > 0) {
      const totalAmount = Number(streamContractBalance) // Convert to Algos
      const totalDuration = (totalAmount / Number(streamFlowRate)) * 1000 // Duration in milliseconds

      //////
      const currentTime = Math.floor(Date.now() / 1000)

      if (currentTime >= epochStreamfinishTime) {
        setAnimationDuration(0)
        setFinalDisplayAmount(streamContractBalance)
        return
      }

      const elapsedtime = currentTime - epochStreamStartTime
      const TotalStreamed = elapsedtime * streamFlowRate * 1000000
      const elapsedAmount = TotalStreamed - totalUserWithdraw * 1000000
      const FinalDisplayAmount = elapsedAmount / 1000000
      setFinalDisplayAmount(FinalDisplayAmount)
      //////
      setAnimationDuration(totalDuration)
    }
  }

  async function fetchStreamBoxData() {
    try {
      // const streamId = 1
      const streamIdArray = new Uint8Array(8) // Creates an 8-byte array
      new DataView(streamIdArray.buffer).setUint32(4, Number(streamId))
      // Fetch the box data for the provided appId and streamId
      const boxValueResponse = await algorand.client.algod.getApplicationBoxByName(appId, streamIdArray).do()
      const NameofBox = boxValueResponse.name
      const dataView = new DataView(NameofBox.buffer)
      const decodedValue = dataView.getBigUint64(0, false)

      const ValueofBox = boxValueResponse.value
      const boxvalues = new DataView(ValueofBox.buffer)
      const rate = Number(boxvalues.getBigUint64(0, false))
      const startTime = Number(boxvalues.getBigUint64(8, false))
      const endTime = Number(boxvalues.getBigUint64(16, false))
      const withdrawnAmount = Number(boxvalues.getBigUint64(24, false))
      const recipient = algosdk.encodeAddress(new Uint8Array(ValueofBox.slice(32, 64)))
      const streamCreator = algosdk.encodeAddress(new Uint8Array(ValueofBox.slice(64, 96)))
      const balance = Number(boxvalues.getBigUint64(96, false))
      const isStreamingRaw = boxvalues.getUint8(104)
      // const isStreaming = isStreamingRaw !== 0
      const last_withdrawal_time = Number(boxvalues.getBigUint64(105, false))

      setepochStreamStartTime(startTime)
      setepochStreamfinishTime(endTime)
      setcreatorDAddress(streamCreator)

      const convTotalwithdrawAmount = withdrawnAmount / 1000000
      const convstreamalgoFlowRate = rate / 1000000
      const convTotalContractbalance = balance / 1000000

      // Convert Unix timestamps to human-readable dates
      const formattedStreamStartTime = startTime ? dayjs.unix(startTime).format('MM/DD/YYYY, h:mm:ss A') : 'N/A'
      const formattedStreamFinishTime = endTime ? dayjs.unix(endTime).format('MM/DD/YYYY, h:mm:ss A') : 'N/A'

      setIsStreaming(isStreamingRaw)
      setStreamContractBalance(convTotalContractbalance)
      setStreamStartTime(formattedStreamStartTime)
      setStreamFinishTime(formattedStreamFinishTime)
      setStreamFlowRate(convstreamalgoFlowRate)
      setTotalUserWithdraw(convTotalwithdrawAmount)
      setReciverAddress(recipient)
      if (isStreamingRaw == 0) {
        toast.error('Incorrect StreamID')
      }
    } catch (error) {
      console.error('Error fetching box data:', error)
      toast.error('Incorrect StreamID')
      setIsStreaming(0)
      throw error
    }
  }

  //FIF frontend internal function
  const userBalanceFetch = async () => {
    const accountInfo = await algorand.client.algod.accountInformation(activeAddress!).do()
    const userBalance = accountInfo.amount
    setUserAccountBalance(userBalance / 1e6)
  }

  useEffect(() => {
    if (activeAddress && dmClient && streamId == 0n) {
      userBalanceFetch()
    }
  }, [activeAddress, streamId, dmClient])

  useEffect(() => {
    if (debounceStreamId) {
      fetchStreamBoxData()
      userBalanceFetch()
    }
  }, [debounceStreamId, totalUserWithdraw])

  useEffect(() => {
    if (Date.now() / 1000 < epochStreamfinishTime) {
      const interval = setInterval(() => {
        calculateAnimationDuration()
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setFinalDisplayAmount(streamContractBalance)
    }
    return () => {
      setFinalDisplayAmount(streamContractBalance)
      setAnimationDuration(0)
    }
  }, [isStreaming, epochStreamfinishTime, streamFlowRate, streamContractBalance])

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
        <div>
          <ToastContainer position="top-left" autoClose={3000} />
        </div>
      </center>

      <div className="text-center rounded-2xl mt-8 border-solid border-white p-4 max-w-md backdrop-blur-[5px] bg-[rgba(21,6,29,0.8)] mx-auto">
        <div className="max-w-md">
          <label className="block mb-2 text-lg font-medium text-gray-900 dark:text-white">Enter Your StreamId</label>
          <input
            type="number"
            placeholder="4"
            className="bg-gray-50 border border-gray-300 text-gray-900 text-[18px]  rounded-lg focus:ring-blue-500  focus:border-blue-500 block w-full p-3 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            onChange={handleStreamIdChange}
          ></input>
          {!activeAddress && (
            <button className="btn rounded-2xl bg-purple-700 hover:bg-purple-800 text-white  text-base mt-4" onClick={toggleWalletModal}>
              Connect Wallet
            </button>
          )}
        </div>
      </div>
      {activeAddress && appId > 0 && isStreaming === 128 && (
        <center>
          <div className="mt-11">
            <div className="text-white text-[22px] font-semibold mb-7 flex justify-center">
              <div className="justify-start  w-full flex max-w-[160px]">
                <AnimatedCounter from={finalDisplayAmount} to={streamContractBalance} duration={animationDuration / 1000} />
              </div>
            </div>
            <div className="mb-11 flex justify-center">
              <h2 className="text-[21px] font-medium text-gray-900 dark:text-white mr-8">
                {creatorDAddress?.slice(0, 6)}.....{creatorDAddress?.slice(-4)}
              </h2>
              <BlinkBlurB></BlinkBlurB>
              <h2 className="text-[21px] font-medium text-gray-900 dark:text-white ml-8">
                {reciverAddress?.slice(0, 6)}.....{reciverAddress?.slice(-4)}
              </h2>
              <div className="m-1">
                <img src="/up-128.png" alt="logo" width={20} className="animate-pulse ml-1" />
              </div>
            </div>
          </div>
        </center>
      )}
      {activeAddress && appId > 0 && isStreaming === 128 && (
        <div className="hero antialiased text-[21px]">
          <div className="backdrop-blur-[5px] bg-[rgba(44,33,59,0.48)]  p-4 rounded-2xl mt-5 mb-5 border-white border-solid border-2">
            <table className="border-3  text-gray-500 dark:text-gray-400">
              <tbody>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-1 ">Your StreamId</th>
                  <th className="text-white ml-auto mt-2 mr-2 ">{Number(debounceStreamId)}</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-1 ">Your Address</th>
                  <th className="text-white ml-32 mr-2 ">{reciverAddress}</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">TotalContractBalance</th>
                  <th className="text-green-400 ml-auto mt-1 mr-2 ">{streamContractBalance} Algos</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">StreamStartTime</th>
                  <th className="text-white ml-auto mt-1 mr-2 ">{streamStartTime}</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">StreamFinishTime</th>
                  <th className="text-white ml-auto mt-1 mr-2 ">{streamFinishTime}</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">AlgoFlowRate</th>
                  <th className="text-white ml-auto mt-1 mr-2 ">{streamFlowRate} P/Sec Algos</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">TotalWithdrawAmount</th>
                  <th className="text-red-400 ml-auto mt-1 mr-2 ">{totalUserWithdraw} Algos</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">ActiveStream</th>
                  <th className="text-green-300 ml-auto mt-1 mr-2 ">{isStreaming === 128 ? 'Yes' : 'NO'} </th>
                </tr>
              </tbody>
            </table>

            <div className="mt-3 mb-3">
              <center>
                {/* <button
                  className="btn rounded-2xl  font-medium text-[22px] mr-6 mt-4 bg-purple-700 hover:bg-purple-800 text-white"
                  onClick={currentWithdrawAmount}
                >
                  CheckAvailableAmount
                </button> */}

                <div className="relative group">
                  <button
                    className="btn text-[23px] px-52 mt-4 font-medium rounded-2xl bg-purple-700 hover:bg-purple-800 text-white"
                    onClick={handleWithdraw}
                  >
                    Withdraw
                  </button>
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 text-center text-white bg-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    This action will withdraw funds.
                  </span>
                </div>
              </center>
            </div>
          </div>
        </div>
      )}
      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
      <Transact openModal={openDemoModal} setModalState={setOpenDemoModal} />
    </div>
  )
}

export default Withdraw
