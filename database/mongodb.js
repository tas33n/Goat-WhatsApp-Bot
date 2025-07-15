const { MongoClient } = require("mongodb")
let client
let collection

module.exports = {
  connect: async (uri) => {
    client = new MongoClient(uri)
    await client.connect()
    const db = client.db()
    collection = db.collection("bot_data")
  },
  get: async (key) => {
    const doc = await collection.findOne({ _id: key })
    return doc ? doc.value : undefined
  },
  set: async (key, value) => {
    await collection.updateOne({ _id: key }, { $set: { value } }, { upsert: true })
  },
  delete: async (key) => {
    await collection.deleteOne({ _id: key })
  },
}
