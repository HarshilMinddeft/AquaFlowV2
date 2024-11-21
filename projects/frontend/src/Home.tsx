// src/components/Home.tsx
import * as algokit from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet'
import algosdk from 'algosdk'
import dayjs from 'dayjs'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import AnimatedCounter from './components/AnimatedCounter'
import ConnectWallet from './components/ConnectWallet'
import BlinkBlurB from './components/Loders'
import Nav from './components/Nav'
import Transact from './components/Transact'
import { AquaFlowV2Client } from './contracts/AquaFlowV2'
import { deleteStream, startStream, stopStream } from './methods'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
interface HomeProps {}

const Home: React.FC<HomeProps> = () => {
  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [openDemoModal, setOpenDemoModal] = useState<boolean>(false)
  const [appId, setAppId] = useState<number>(729020888)
  const [streamId, setStreamId] = useState<bigint>(0n)
  const [inputAppId, setInputAppId] = useState<number | null>(null)
  const { activeAddress, signer } = useWallet()
  const [sender, setSenderAddress] = useState<string>('')
  const [streamRate, setStreamRate] = useState<bigint>(0n)
  const [isStreaming, setIsStreaming] = useState<number>(0)
  const [loding, setLoding] = useState<boolean>(false)
  const [recipient, setRecipient] = useState<string>('')
  const [amount, setAmount] = useState<bigint>(0n)
  const [streamApproxEndTime, setApproxEndTime] = useState<string>('')
  const [streamApproxHoursMins, setstreamApproxHoursMins] = useState<string>('')
  const [streamContractBalance, setStreamContractBalance] = useState<number>(0)
  const [streamStartTime, setStreamStartTime] = useState<string>()
  const [streamFinishTime, setStreamFinishTime] = useState<string>()
  const [streamFlowRate, setStreamFlowRate] = useState<number>(0)
  const [totalUserWithdraw, setTotalUserWithdraw] = useState<number>(0)
  const [reciverAddress, setReciverAddress] = useState<string>()
  const [creatorDAddress, setcreatorDAddress] = useState<string>()
  const [animationDuration, setAnimationDuration] = useState<number>(0)
  const [epochStreamStartTime, setepochStreamStartTime] = useState<number>(0)
  const [userAccountBalance, setUserAccountBalance] = useState<number>()
  const [timeUnit, setTimeUnit] = useState<string>('sec')
  const [displayFlowAmount, setdisplayFlowAmount] = useState(0)
  const [epochStreamfinishTime, setepochStreamfinishTime] = useState<number>(0)
  const [navigationMod, setNavigationMod] = useState<string>('DeployApp')
  const [internalTxns, setInternalTxns] = useState<Array<{ amount: number; receiver: string }>>([])
  const navigate = useNavigate()

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
      // console.log('Box Name decoded:', decodedValue)
      // console.log('Box Name:', boxValueResponse.name)
      // console.log('Box Value:', boxValueResponse.value)

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
    } catch (error) {
      console.error('Error fetching box data:', error)
      throw error
    }
  }

  // Create stream method reference
  // const createStream = async () => {
  //   setLoding(true)
  //   await create(algorand, dmClient, activeAddress!, setAppId)()
  //   setLoding(false)
  // }

  const funcStopStream = async () => {
    try {
      setLoding(true)
      const transactions = await stopStream(algorand, dmClient, activeAddress!, appId, recipient, streamId)()
      setInternalTxns(transactions)
      setLoding(false)
      await fetchStreamBoxData()
      toast.success('Current Stream Stopped')
    } catch (error) {
      if (error instanceof Error) {
        setLoding(false)
        if (error.message.includes('Sender; ==; assert')) {
          console.error('Caught a URLTokenBaseHTTPError:', error.message)
          toast.error('You are not owner of this stream')
        } else {
          console.error('An error occurred:', error.message)
        }
      } else {
        console.error('An unknown error occurred:', error)
      }
    }
  }

  const funcdeleteStream = async () => {
    try {
      const deleteConfirmation = await deleteStream(algorand, dmClient, activeAddress!, appId, streamId)()
      if (deleteConfirmation) {
        setInternalTxns(deleteConfirmation)
        setStreamId(0n)
        setStreamRate(0n)
        setIsStreaming(0)
        setStreamContractBalance(0)
        setepochStreamStartTime(0)
        setepochStreamfinishTime(0)
        setTotalUserWithdraw(0)
        toast.success('Stream Deleted')
      } else {
      }
    } catch (error) {
      console.error('Error deleting Stream:', error)
      toast.error('Only owner can delete this stream')
    }
  }

  // Start stream method reference
  const handleStartStream = async () => {
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
      const streamStarted = await startStream(algorand, dmClient, activeAddress!, sender, streamRate, recipient, amount, appId)()
      setStreamId(streamStarted ?? 0n)
      setLoding(false)
      await fetchStreamBoxData()
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
  const calculateAnimationDuration = () => {
    if (streamFlowRate > 0 && streamContractBalance > 0) {
      const totalAmount = Number(streamContractBalance) // Convert to Algos
      const totalDuration = (totalAmount / Number(streamFlowRate)) * 1000 // Duration in milliseconds
      //////
      const currentTime = Math.floor(Date.now() / 1000)

      if (currentTime >= epochStreamfinishTime) {
        setAnimationDuration(0)
        setdisplayFlowAmount(0)
        return // Stop further calculations
      }

      const elapsedtime = currentTime - epochStreamStartTime
      const TotalStreamed = elapsedtime * streamFlowRate * 1000000
      const elapsedAmount = TotalStreamed - totalUserWithdraw * 1000000
      const DisplayAmount = elapsedAmount / 1000000
      const FinalDisplayAmount = streamContractBalance - DisplayAmount
      setdisplayFlowAmount(FinalDisplayAmount)
      //////
      setAnimationDuration(totalDuration)
    }
  }

  //FIF
  const userBalanceFetch = async () => {
    const accountInfo = await algorand.client.algod.accountInformation(activeAddress!).do()
    const userBalance = accountInfo.amount
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
  }, [])

  useEffect(() => {
    if (activeAddress && dmClient && streamId == 0n) {
      setSenderAddress(activeAddress)
      userBalanceFetch()
    }
  }, [activeAddress, streamId, dmClient])

  useEffect(() => {
    if (streamId) {
      fetchStreamBoxData()
      userBalanceFetch()
    }
  }, [streamId])

  useEffect(() => {
    if (streamRate > 0 && amount > 0) {
      calculateStreamEndTime()
    } else {
      setApproxEndTime('')
    }
  }, [streamRate, amount, activeAddress])

  useEffect(() => {
    if (Date.now() / 1000 < epochStreamfinishTime) {
      const interval = setInterval(() => {
        calculateAnimationDuration()
      }, 1000)
      return () => clearInterval(interval)
    }
    return () => {
      setdisplayFlowAmount(0)
      setAnimationDuration(0)
    }
  }, [epochStreamfinishTime, streamFlowRate, streamContractBalance])

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
        <div className="">
          <ToastContainer position="top-right" autoClose={3000} />
        </div>
      </center>

      <div className="flex flex-row justify-center mt-5">
        <div className=" px-[10px] flex flex-row items-center ">
          <div className="py-[1px] rounded-3xl text-gray-200">
            <button
              onClick={(e) => {
                setNavigationMod('DeployApp')
              }}
              className={`text-white mt-1 ml-3 border-[#170c31f5] from-[#1e0e44bd]  to-[#180b3698] hover:bg-gradient-to-bl font-medium rounded-xl text-[19px] px-5 py-2 text-center me-2 mb-2
                ${navigationMod === 'DeployApp' ? 'bg-[#361352f5] border-[#2d1672dc] from-[#170c31f5] to-[#170c31f5] hover:bg-gradient-to-bl' : ''}`}
            >
              CreateStream
            </button>

            <button
              onClick={() => navigate('/SearchStream')}
              className={`text-white mt-1 ml-3 border-[#170c31f5] from-[#1e0e44bd]  to-[#180b3698] hover:bg-gradient-to-bl font-medium rounded-xl text-[19px] px-5 py-2 text-center me-2 mb-2
                ${navigationMod === 'SearchApp' ? 'bg-[#361352f5] border-[#2d1672dc] from-[#170c31f5] to-[#170c31f5] hover:bg-gradient-to-bl' : ''}`}
            >
              SearchStream
            </button>
          </div>
        </div>
      </div>
      {!activeAddress && (
        <button
          className="btn hero rounded-2xl bg-purple-700 hover:bg-purple-800 max-w-md  text-white text-[20px] px-11 mt-4 mx-auto"
          onClick={toggleWalletModal}
        >
          Connect Wallet
        </button>
      )}

      {activeAddress && appId > 0 && isStreaming === 128 && (
        <div className="text-center rounded-2xl mt-7 border-solid border-2 slate-800 p-3 max-w-md backdrop-blur-[5px] bg-[rgba(21,6,29,0.8)]  mx-auto">
          <label className="block text-[19px] mb-2 font-medium text-gray-900 dark:text-white">Stream ID</label>
          <input
            disabled={true}
            type="number"
            className="bg-gray-50 border cursor-text border-gray-300 text-gray-900 text-[18px]  rounded-lg focus:ring-blue-500  focus:border-blue-500 block w-full p-3 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            value={Number(streamId)}
          ></input>
        </div>
      )}

      {activeAddress && appId > 0 && isStreaming === 128 && (
        <center>
          <div className="mt-9">
            <div className="text-white ml-10 text-[22px] font-semibold mb-7 flex justify-center">
              <div className="justify-start w-full flex max-w-[190px]">
                <AnimatedCounter from={displayFlowAmount} to={0} duration={animationDuration / 1000} />
              </div>
            </div>
            <div className="mb-11 flex justify-center ">
              <div className="mt-[6px] mr-1">
                <img src="/down-128.png" alt="logo" width={20} className="animate-pulse" />
              </div>
              <h2 className="text-[21px] font-medium text-gray-900 dark:text-white mr-8">
                {creatorDAddress?.slice(0, 6)}.....{creatorDAddress?.slice(-4)}
              </h2>
              <BlinkBlurB></BlinkBlurB>
              <h2 className="text-[21px] font-medium text-gray-900 dark:text-white ml-8">
                {reciverAddress?.slice(0, 6)}.....{reciverAddress?.slice(-4)}
              </h2>
            </div>
          </div>
        </center>
      )}
      {activeAddress && isStreaming === 0 && internalTxns.length > 0 && (
        <center>
          <div className="backdrop-blur-[5px] bg-[rgba(21,6,29,0.8)] mt-8 w-[900px] p-2 rounded-2xl mb-5  border-solid border-2">
            <h3 className="block mb-2 text-lg text-center font-medium text-gray-900 dark:text-white">Recent Stream Distributed Amounts</h3>
            {internalTxns.length > 0 ? (
              <ul>
                <ul className="flex mb-2 text-lg font-normal text-gray-900 dark:text-white">
                  <li>Receiver</li>
                  <li className="ml-auto">Amount</li>
                </ul>
                {internalTxns.map((txn, index) => (
                  <li className="flex  mb-2 text-base font-normal text-gray-900 dark:text-white" key={index}>
                    {txn.receiver} <p className="ml-auto ">{txn.amount}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No internal transactions found.</p>
            )}
          </div>
        </center>
      )}

      {activeAddress && appId > 0 && isStreaming === 0 && navigationMod == 'DeployApp' && (
        <div className="text-center  rounded-2xl mt-5  p-6 max-w-md backdrop-blur-[5px] bg-[rgba(21,6,29,0.8)]  mx-auto">
          <div className="max-w-md">
            <div className="grid ">
              <div>
                <h1 className="block mb-2 text-xl font-medium text-gray-900 dark:text-white">StreamID {streamId.toString()}</h1>
                {/* <h2 className="block mb-2 mt-4  text-2xl font-medium text-gray-900 dark:text-white">Create Payment Stream</h2> */}
                <div className="mt-4">
                  <label className="block mr-72 text-lg font-medium text-gray-900 dark:text-white">Your Address</label>
                  <input
                    type="text"
                    disabled={true}
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
                    min={0}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    // value={Number(amount) / 1e6}
                    onChange={(e) => {
                      const inputVal = e.target.valueAsNumber // Get the value as a number (in Algos)
                      const microAlgos = BigInt(Math.round(inputVal * 1e6)) // Convert Algos to microAlgos as BigInt
                      setAmount(microAlgos) // Store as BigInt (μAlgos)
                      setTimeUnit('sec')
                    }}
                  />
                </div>
                <div className="mt-4 firstField">
                  <label className="text-lg mr-[179px] font-medium text-gray-900 dark:text-white ">Custom Flow-rate Per/sec</label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="0.01"
                      min={0}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                      onChange={(e) => {
                        const inputVal = e.currentTarget.valueAsNumber
                        const bigintVal = BigInt(Math.round(inputVal * 1e6)) // Convert the decimal to μAlgos as BigInt
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
                  <label className="block mr-48 text-lg font-medium text-gray-900 dark:text-white">Auto Flow-rate Per/sec</label>
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
                      onClick={handleStartStream}
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
      {activeAddress && appId > 0 && isStreaming === 128 && (
        <div className="hero antialiased mt-11 text-[21px]">
          <div className="backdrop-blur-[5px] bg-[rgba(44,33,59,0.48)]  p-4 rounded-2xl mb-5 border-white border-solid border-2">
            <table className="border-3  text-gray-500 dark:text-gray-400">
              <tbody>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-1 ">Receiver</th>
                  <th className="text-white ml-32 mt-2 mr-2 ">{reciverAddress}</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">TotalContractBalance</th>
                  <th className="text-red-400 ml-auto mt-2 mr-2 ">{streamContractBalance} Algos</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">StreamStartTime</th>
                  <th className="text-white ml-auto mt-2 mr-2 ">{streamStartTime}</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">StreamFinishTime</th>
                  <th className="text-white ml-auto mt-2 mr-2 ">{streamFinishTime}</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">AlgoFlowRate</th>
                  <th className="text-white ml-auto mt-2 mr-2 ">{streamFlowRate} P/Sec Algos</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">TotalWithdrawAmount</th>
                  <th className="text-green-500 ml-auto mt-2 mr-2 ">{totalUserWithdraw} Algos</th>
                </tr>
                <tr className="flex border-solid border-b border-slate-200">
                  <th className="text-white font-medium mt-2">ActiveStream</th>
                  <th className="text-white ml-auto mt-2 mr-2 ">{isStreaming === 128 ? 'Yes' : 'NO'} </th>
                </tr>
              </tbody>
            </table>
            <div className="mt-2">
              <center>
                <button
                  className="btn rounded-2xl  font-medium text-[22px] mr-6 mt-4 bg-purple-700 hover:bg-purple-800 text-white"
                  onClick={funcStopStream}
                >
                  {loding ? <span className="loading loading-spinner" /> : 'StopStream'}
                </button>
                <button
                  className="btn text-[22px] mt-4  font-medium rounded-2xl bg-purple-700 hover:bg-purple-800 text-white"
                  onClick={funcdeleteStream}
                >
                  DeleteStream
                </button>
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

export default Home
