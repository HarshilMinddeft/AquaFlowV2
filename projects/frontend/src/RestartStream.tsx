// src/components/RestartStream.tsx
import * as algokit from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import ConnectWallet from './components/ConnectWallet'
import Nav from './components/Nav'
import Transact from './components/Transact'
import { AquaFlowV2Client } from './contracts/AquaFlowV2'
import { startStreamWithExistId } from './methods'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
interface RestartStreamProps {}

const RestartStream: React.FC<RestartStreamProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [openDemoModal, setOpenDemoModal] = useState<boolean>(false)
  const [appId, setAppId] = useState<number>(729020888)
  // const [streamId, setStreamId] = useState<bigint>(0n)
  const { activeAddress, signer } = useWallet()
  const [sender, setSenderAddress] = useState<string>('')
  const [streamRate, setStreamRate] = useState<bigint>(0n)
  const [loding, setLoding] = useState<boolean>(false)
  const [recipient, setRecipient] = useState<string>('')
  const [amount, setAmount] = useState<bigint>(0n)
  const [streamApproxEndTime, setApproxEndTime] = useState<string>('')
  const [streamApproxHoursMins, setstreamApproxHoursMins] = useState<string>('')
  const [userAccountBalance, setUserAccountBalance] = useState<number>()
  const [timeUnit, setTimeUnit] = useState<string>('sec')
  const location = useLocation()
  const { streamId } = location.state || { streamId: 0n }
  const navigate = useNavigate()

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
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

  // Start stream method reference
  const handleRestartStream = async () => {
    // Fetch the user's account balance
    if (!recipient || amount <= 0n || streamRate <= 0n) {
      toast.error('Please fill out all required fields: recipient address, amount, and stream rate.')
      return
    }
    try {
      const accountInfo = await algorand.client.algod.accountInformation(activeAddress!).do()
      const userBalance = accountInfo.amount // Balance in microAlgos

      // Ensure user has enough balance before starting the stream
      const totalCost = Number(amount) + 2000000 + (streamRate > 0 ? 0.1 * Number(streamRate) : 0) // Adjust totalCost logic as needed
      if (userBalance < totalCost) {
        toast.error('Insufficient funds to start the stream. Keep 2 extra Algos in wallet for avoiding errors.')
        return // Exit the function if insufficient funds
      }

      // Try to start the stream
      toast.info('Confirm payment')
      setLoding(true)
      const streamStarted = await startStreamWithExistId(
        algorand,
        dmClient,
        activeAddress!,
        sender,
        streamRate,
        recipient,
        amount,
        appId,
        streamId,
      )()
      console.log('streamStarted ID', streamStarted)
      setLoding(false)
      navigate('/SearchStream', { state: { streamId } })
      // setIsStreaming(0) // Only set streaming state if startStream is successful
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('URLTokenBaseHTTPError')) {
          console.error('Caught a URLTokenBaseHTTPError:', error.message)
        } else {
          console.error('An error occurred:', error.message)
        }
      } else {
        console.error('An unknown error occurred:', error)
      }
    }
  }

  //FIF
  const calculateStreamEndTime = () => {
    if (streamRate > 0n && amount > 0n) {
      const durationInSeconds = Number(amount) / Number(streamRate)
      const endTime = new Date(Date.now() + durationInSeconds * 1000)
      const hours = Math.floor(durationInSeconds / 3600)
      const minutes = Math.floor((durationInSeconds % 3600) / 60)
      const formattedEndTime = dayjs(endTime).format('MM/DD/YYYY, h:mm:ss A')
      setApproxEndTime(`${formattedEndTime}`)
      setstreamApproxHoursMins(`(${hours} hours, ${minutes} minutes)`)
    }
  }

  //FIF
  const userBalanceFetch = async () => {
    const accountInfo = await algorand.client.algod.accountInformation(activeAddress!).do()
    const userBalance = accountInfo.amount
    console.log('userBalance', userBalance)
    setUserAccountBalance(userBalance / 1e6)
  }

  // Conversion factors for time units
  const timeUnitToSeconds = (unit: string) => {
    switch (unit) {
      case 'sec':
        return 60
      case 'min':
        return 350
      case 'hour':
        return 3600
      case 'day':
        return 86400
      case 'week':
        return 604800
      case 'month':
        return 2629800
      case 'year':
        return 31536000 // Approx 365 days
      default:
        return 1
    }
  }
  //FIF
  const updateStreamRate = (newAmount: bigint, newTimeUnit: string) => {
    const seconds = timeUnitToSeconds(newTimeUnit)
    const rate = Number(newAmount) / seconds // μAlgos/sec
    const bigintRate = BigInt(Math.round(rate)) // μAlgos/sec as BigInt
    setStreamRate(bigintRate)
  }
  //FIF
  const handleTimeUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTimeUnit = e.target.value
    setTimeUnit(newTimeUnit)
    updateStreamRate(amount, newTimeUnit)
  }

  useEffect(() => {
    if (appId > 0) updateStreamRate(amount, timeUnit)

    console.log('UseEffect 1')
  }, [])

  useEffect(() => {
    if (activeAddress && dmClient) {
      setSenderAddress(activeAddress)
      console.log('StreamId=>', streamId)
      userBalanceFetch()
      console.log('UseEffect 2')
    }
  }, [activeAddress, streamId, dmClient])

  useEffect(() => {
    if (streamId) {
      userBalanceFetch()
      console.log('UseEffect 5')
    }
  }, [streamId])

  useEffect(() => {
    if (streamRate > 0 && amount > 0) {
      calculateStreamEndTime()
      console.log('UseEffect 3')
    } else {
      setApproxEndTime('')
    }
  }, [streamRate, amount, activeAddress])

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
        <div className="">
          <ToastContainer position="top-right" autoClose={3000} />
        </div>
      </center>

      {activeAddress && appId > 0 && (
        <div className="text-center  rounded-2xl mt-5  p-6 max-w-md backdrop-blur-[5px] bg-[rgba(21,6,29,0.8)]  mx-auto">
          <div className="max-w-md">
            <div className="grid ">
              <div>
                <h1 className="block mb-2 text-xl font-medium text-gray-900 dark:text-white">StreamID {streamId.toString()}</h1>
                <div className="mt-4">
                  <label className="block mr-72 text-lg font-medium text-gray-900 dark:text-white">Your Address</label>
                  <input
                    type="text"
                    placeholder="Your Address"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    value={sender}
                    onChange={(e) => e.target.value}
                  />
                </div>
                <div className="mt-4">
                  <label className="block mr-60 text-lg font-medium text-gray-900 dark:text-white">Recipient Address</label>
                  <input
                    type="text"
                    placeholder="Enter Recipient Address"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>
                <div className="mt-4">
                  <label className="block mr-80  text-lg font-medium text-gray-900 dark:text-white">Amount</label>
                  <input
                    type="number"
                    placeholder="1"
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    // value={Number(amount) / 1e6}
                    onChange={(e) => {
                      const inputVal = e.target.valueAsNumber // Get the value as a number (in Algos)
                      const microAlgos = BigInt(Math.round(inputVal * 1e6)) // Convert Algos to microAlgos as BigInt
                      console.log('InputAmount', microAlgos)
                      setAmount(microAlgos) // Store as BigInt (μAlgos)
                      setTimeUnit('sec')
                    }}
                  />
                </div>
                <div className="mt-4 firstField">
                  <label className="text-lg mr-[179px] font-medium text-gray-900 dark:text-white ">Custom Flowrate Per/sec</label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="0.01"
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                      onChange={(e) => {
                        const inputVal = e.currentTarget.valueAsNumber
                        const bigintVal = BigInt(Math.round(inputVal * 1e6)) // Convert the decimal to μAlgos as BigInt
                        console.log('FlowRateAs', bigintVal)
                        setStreamRate(bigintVal)
                        setTimeUnit('sec')
                      }}
                    />
                  </div>
                </div>
                <div>
                  <p className="mt-3 mb-3  block text-lg font-medium text-gray-900 dark:text-white">OR</p>
                </div>
                <div className="mt-1 secondField">
                  <label className="block mr-48 text-lg font-medium text-gray-900 dark:text-white">Auto Flowrate Per/sec</label>
                  <div className="flex items-center">
                    <select
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-[20px] rounded-lg focus:ring-blue-500 focus:border-blue-500 p-3 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 cursor-pointer"
                      value={timeUnit}
                      onChange={handleTimeUnitChange}
                    >
                      <option value="sec">Sec</option>
                      <option value="min">5 Min</option>
                      <option value="hour">1 Hour</option>
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>

                    <input
                      type="number"
                      disabled={true}
                      placeholder="0.001"
                      className="bg-gray-50 border ml-1 border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                      value={Number(streamRate) / 1e6}
                      onChange={(e) => {
                        const inputVal = e.currentTarget.valueAsNumber
                        const bigintVal = BigInt(Math.round(inputVal * 1e6))
                        console.log('FlowRateAs', bigintVal)
                        setStreamRate(bigintVal)
                      }}
                    />
                  </div>
                </div>

                <div className="block text-xl font-medium text-gray-900 dark:text-white">
                  {streamApproxEndTime && <h2 className=" text-[23px] mt-3">Stream Till: {streamApproxEndTime.toLocaleString()}</h2>}
                  {streamApproxEndTime && (
                    <h2 className=" text-[22px] mt-1">Stream Ending in: {streamApproxHoursMins.toLocaleString()} Approx</h2>
                  )}
                </div>
                {activeAddress && (
                  <div className="mt-3">
                    <button
                      className="btn rounded-2xl text-lg mt-4 bg-purple-700 hover:bg-purple-800 text-white"
                      onClick={handleRestartStream}
                    >
                      {loding ? <span className="loading loading-spinner" /> : 'CreateStream'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
      <Transact openModal={openDemoModal} setModalState={setOpenDemoModal} />
    </div>
  )
}

export default RestartStream
