const express = require("express");
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require('dotenv').config()

//set meddlewar
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5a8lj4m.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuConllection = client.db('bistroDb').collection('menu')
    const reviewConllection = client.db('bistroDb').collection('reviews')


    app.get('/menu', async (req, res) => {
        const result = await menuConllection.find().toArray();
        res.send(result);
    })
    app.get('/reviews', async (req, res) => {
        const result = await reviewConllection.find().toArray();
        res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('bistro boss are sitting');
})

app.listen(port, () => {
    console.log(`bistro boss are sitting on ${port}`)
})