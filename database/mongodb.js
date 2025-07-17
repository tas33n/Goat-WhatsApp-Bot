const { MongoClient } = require("mongodb")
let client
let db
let userCollection
let threadCollection
let dataCollection

module.exports = {
  connect: async (uri) => {
    client = new MongoClient(uri)
    await client.connect()
    db = client.db("whatsapp_bot")
    
    // Create separate collections for users, threads, and general data
    userCollection = db.collection("users")
    threadCollection = db.collection("threads")
    dataCollection = db.collection("data")
    
    // Create indexes for better performance
    await userCollection.createIndex({ "_id": 1 })
    await threadCollection.createIndex({ "_id": 1 })
    await dataCollection.createIndex({ "_id": 1 })
  },
  
  get: (key) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      return threadCollection.findOne({ _id: threadId }).then(doc => doc ? doc.data : undefined)
    }
    if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      return userCollection.findOne({ _id: userId }).then(doc => doc ? doc.data : undefined)
    }
    return dataCollection.findOne({ _id: key }).then(doc => doc ? doc.data : undefined)
  },
  
  set: async (key, value) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      await threadCollection.updateOne(
        { _id: threadId }, 
        { $set: { data: value, updatedAt: new Date() } }, 
        { upsert: true }
      )
    } else if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      await userCollection.updateOne(
        { _id: userId }, 
        { $set: { data: value, updatedAt: new Date() } }, 
        { upsert: true }
      )
    } else {
      await dataCollection.updateOne(
        { _id: key }, 
        { $set: { data: value, updatedAt: new Date() } }, 
        { upsert: true }
      )
    }
  },
  
  delete: async (key) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      await threadCollection.deleteOne({ _id: threadId })
    } else if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      await userCollection.deleteOne({ _id: userId })
    } else {
      await dataCollection.deleteOne({ _id: key })
    }
  },
  
  getByPrefix: async (prefix) => {
    if (prefix === "user_") {
      const users = await userCollection.find({}).toArray()
      const result = {}
      users.forEach(user => {
        result[user._id] = user.data
      })
      return result
    }
    if (prefix === "thread_") {
      const threads = await threadCollection.find({}).toArray()
      const result = {}
      threads.forEach(thread => {
        result[thread._id] = thread.data
      })
      return result
    }
    const data = await dataCollection.find({ _id: { $regex: `^${prefix}` } }).toArray()
    const result = {}
    data.forEach(item => {
      result[item._id] = item.data
    })
    return result
  },
  
  getAllKeys: async () => {
    const userKeys = await userCollection.find({}, { projection: { _id: 1 } }).toArray()
    const threadKeys = await threadCollection.find({}, { projection: { _id: 1 } }).toArray()
    const dataKeys = await dataCollection.find({}, { projection: { _id: 1 } }).toArray()
    
    return [
      ...userKeys.map(k => `user_${k._id}`),
      ...threadKeys.map(k => `thread_${k._id}`),
      ...dataKeys.map(k => k._id)
    ]
  },
  
  has: async (key) => {
    if (key.startsWith("thread_")) {
      const threadId = key.replace("thread_", "")
      const count = await threadCollection.countDocuments({ _id: threadId })
      return count > 0
    }
    if (key.startsWith("user_")) {
      const userId = key.replace("user_", "")
      const count = await userCollection.countDocuments({ _id: userId })
      return count > 0
    }
    const count = await dataCollection.countDocuments({ _id: key })
    return count > 0
  },
  
  getAllData: async () => {
    const users = await userCollection.find({}).toArray()
    const threads = await threadCollection.find({}).toArray()
    const data = await dataCollection.find({}).toArray()
    
    const usersData = {}
    const threadsData = {}
    const generalData = {}
    
    users.forEach(user => {
      usersData[user._id] = user.data
    })
    
    threads.forEach(thread => {
      threadsData[thread._id] = thread.data
    })
    
    data.forEach(item => {
      generalData[item._id] = item.data
    })
    
    return { data: generalData, threads: threadsData, users: usersData }
  },
  
  getStats: async () => {
    const userCount = await userCollection.countDocuments()
    const threadCount = await threadCollection.countDocuments()
    const dataCount = await dataCollection.countDocuments()
    
    return {
      users: userCount,
      threads: threadCount,
      data: dataCount,
      total: userCount + threadCount + dataCount
    }
  }
}