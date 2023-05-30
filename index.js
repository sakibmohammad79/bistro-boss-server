const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cors = require("cors");
const jwt = require('jsonwebtoken');
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

    const userCollection = client.db('bistroDb').collection('users')
    const menuCollection = client.db('bistroDb').collection('menu')
    const reviewCollection = client.db('bistroDb').collection('reviews')
    const cartCollection = client.db('bistroDb').collection('carts')
    //get all non powerful user
    app.get('/users', async (req, res)=> {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    //user info post related
    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query);
      console.log('existing user', existingUser);
      if(existingUser){
        return res.send({message: 'Already Have An Same Account'})
      }
      const result = await userCollection.insertOne(user);
      console.log(result);
      res.send(result);
    })

    //user role
    app.patch('/users/admin/:id', async (req,res) => {
      const id = req.params.id;
      const filter ={_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    //menu related
    app.get('/menu', async (req, res) => {
        const result = await menuCollection.find().toArray();
        res.send(result);
    })
    //reviews related
    app.get('/reviews', async (req, res) => {
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })
    
    
    //data load by email table related
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      if(!email){
        return ([]);
      }
      const query = {email: email}
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

    //single item post item related
    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })

    //delete one item in table
    app.delete('/carts/:id', async(req, res)=> {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query);
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