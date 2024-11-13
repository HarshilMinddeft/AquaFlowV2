import * as algokit from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet'
import React, { useEffect, useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import Nav from './components/Nav'
import Transact from './components/Transact'
import { AquaFlowV2Client } from './contracts/AquaFlowV2'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

interface AccountHistoryProps {}

const AccountHistory: React.FC<AccountHistoryProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [openDemoModal, setOpenDemoModal] = useState<boolean>(false)
  const [appId, setAppId] = useState<number>(728805691)
  const { activeAddress, signer } = useWallet()
  const [userAccountBalance, setUserAccountBalance] = useState<number>()
  const [createdApps, setCreatedApps] = useState<{ id: number; params: any }[]>([])

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
      console.log('Box List:', boxList)

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

      console.log('Decoded Box Numbers:', decodedBoxNumbers)
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
      console.log('Fetching')
    }
  }, [activeAddress])

  return (
    <div className="min-h-screen bg-custom-gradient">
      <center>
        <button
          data-test-id="connect-wallet"
          className="btn px-8 bg-purple-700 z-10 mt-2 right-2 hover:bg-purple-800 text-white pb-3 pt-2 text-xl rounded-2xl absolute "
          onClick={toggleWalletModal}
        >
          {!activeAddress ? 'Connect Wallet' : activeAddress && `Balance ${userAccountBalance} algos`}
        </button>
      </center>
      <div className="relative">
        <Nav />
      </div>
      <center>
        <div className="w-[820px] antialiased mt-20 text-[21px]">
          <h2 className="text-white font-medium mb-6 text-[30px]">All Created Applications</h2>
          <div className="backdrop-blur-[5px] bg-[rgba(44,33,59,0.48)] p-4 rounded-2xl border-white border-solid border-2">
            <table className="border-3 w-full text-gray-500 dark:text-gray-400">
              <thead>
                <tr className="flex">
                  <th className="mr-auto">App Index</th>
                  <th>App ID</th>
                </tr>
              </thead>
              <tbody>
                {createdApps.map((app, index) => (
                  <tr key={app.id} className="flex border-solid border-b border-slate-200">
                    <th className="text-white font-medium mt-1">{index + 1}</th>
                    <th className="text-white ml-auto mt-2 mr-2">{app.id}</th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </center>
      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
      <Transact openModal={openDemoModal} setModalState={setOpenDemoModal} />
    </div>
  )
}

export default AccountHistory
