const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cors = require("cors");
const nodemailer = require("nodemailer");
const mg = require('nodemailer-mailgun-transport');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config()
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);


//set meddlewar
app.use(cors());
app.use(express.json());

// let transporter = nodemailer.createTransport({
//   host: 'smtp.sendgrid.net',
//   port: 587,
//   auth: {
//       user: "apikey",
//       pass: process.env.SENDGRID_API_KEY
//   }
// })

const auth = {
  auth: {
    api_key: process.envEMAIL_PRIVATE_KEY,
    domain: process.env.EMAIL_DOMAIN
  }
}

const transporter = nodemailer.createTransport(mg(auth));

const sendPaymentConfirmationEmail = (payment) => {
  transporter.sendMail({
    from: "mohammadsakib7679@gmail.com", // verified sender email
    to: payment.email, // recipient email
    subject: "Test message subject", // Subject line
    text: "Hello world!", // plain text body
    html: `
    <div>
        <h2>payment Confirmed</h2>
    </div>
    `, // html body
  }, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
 
}


const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  console.log('authorizition', authorization);
  if(!authorization){
    
    return res.status(401).send({error: true, message: 'unauthoraized access'});
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({error: true, message: 'unauthorzed access'});
    }
    req.decoded= decoded;
    next();
  })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5a8lj4m.mongodb.net/?retryWrites=true&w=majority`;
//console.log(uri)

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
    const paymentCollection = client.db('bistroDb').collection('payments')

    //jwt
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({token});
    })

    const verifyAdmin = async(req, res, next)=>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({error: true, meassage: 'fobidden message'})
      }
      next();
    }

     //get all non powerful user
     app.get('/users', verifyJwt, verifyAdmin, async (req, res)=> {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    //user info post related
    app.post('/users', verifyJwt, async (req, res) => {
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

    //
    app.get('/users/admin/:email', verifyJwt, async(req, res)=>{
      const email = req.params.email;
      if(req.decoded.email !== email){
        res.send({admin: false});
      }
      const query = {email : email};
      const user = await userCollection.findOne(query);
      const result = {admin: user?.role === 'admin'}
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

    app.post('/menu', verifyJwt, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    })

    app.delete('/menu/:id', verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id : new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result)
    })

    //reviews related
    app.get('/reviews', async (req, res) => {
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })
    
    
    //data load by email table related
    app.get('/carts', verifyJwt, async (req, res) => {
      const email = req.query.email;
      if(!email){
        return ([]);
      }

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error:true, meassage: 'porvidden access'});
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

    //create payment intent
    app.post("/create-payment-intent", verifyJwt, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price*100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    //payment related api
    app.post('/payments', verifyJwt, async(req, res) =>  {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      
      const query = {_id: {$in: payment.cartItems.map(id => new ObjectId(id))}}
      const deleteResult = await cartCollection.deleteMany(query)

      //send emailconfirmation
      sendPaymentConfirmationEmail(payment);

      res.send({insertResult, deleteResult});
    })

    app.get('/admin-state',verifyJwt, verifyJwt, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payment)=> payment.price + sum , 0)
      res.send({
        users,
        products,
        orders,
        revenue
      })
    })

     /**
     * ---------------
     * BANGLA SYSTEM(second best solution)
     * ---------------
     * 1. load all payments
     * 2. for each payment, get the menuItems array
     * 3. for each item in the menuItems array get the menuItem from the menu collection
     * 4. put them in an array: allOrderedItems
     * 5. separate allOrderedItems by category using filter
     * 6. now get the quantity by using length: pizzas.length
     * 7. for each category use reduce to get the total amount spent on this category
     * 
    */
     app.get('/order-stats', async (req, res) =>{
      const pipeline = [
        {
          $lookup: {
            from: 'menu',
            localField: 'orderItemId',
            foreignField: '_id',
            as: 'menuItemsData'
          }
        },
        {
          $unwind: '$menuItemsData'
        },
        {
          $group: {
            _id: '$menuItemsData.category',
            count: { $sum: 1 },
            total: { $sum: '$menuItemsData.price' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            total: { $round: ['$total', 2] },
            _id: 0
          }
        }
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray()
      res.send(result)

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