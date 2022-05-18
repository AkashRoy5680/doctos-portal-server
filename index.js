const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qdt9o.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req,res,next){
  const authHeader=req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message:"unauthorized access"});
  }
  const token=authHeader.split(" ")[1];
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      return res.status(403).send({message:"forbidden access"});
    }
    req.decoded=decoded;
    next();
  })
}

async function run(){
  try{
    await client.connect();
    const serviceCollection=client.db("doctors_portal").collection("services");
    const bookingCollection=client.db("doctors_portal").collection("bookings");
    const userCollection=client.db("doctors_portal").collection("users");

    app.get("/service",async(req,res)=>{
      const query={};
      const cursor=serviceCollection.find(query);
      const services=await cursor.toArray();
      res.send(services);
    });

    app.get("/user",verifyJwt,async(req,res)=>{
      const users=await userCollection.find().toArray();
      res.send(users);
    });

    //checking existing user admin or not

    app.get("/admin/:email",async(req,res)=>{
      const email=req.params.email;
      const user=await userCollection.findOne({email:email});
      const isAdmin = user.role ==="admin";
      res.send({admin:isAdmin})
    })

    app.put("/user/admin/:email",verifyJwt,async(req,res)=>{
      const email=req.params.email;
      const requester=req.decoded.email;
      const requesterAccount=await userCollection.findOne({email:requester});
      if(requesterAccount.role=="admin"){
        const filter={email:email}
        const updateDoc = {
          $set:{role:"admin"},
        };
      const result= await userCollection.updateOne(filter,updateDoc);
      res.send(result);
      }
      else{
        res.status(403).send({message:"forbidden"});
      }
    
    });

    app.put("/user/:emailx",async(req,res)=>{
      const user=req.body;
      const email=req.params.emailx;
      console.log(email)
      const filter={email:email}
      const options={upsert:true};
      const updateDoc = {
        $set:user,
      };
    const result=await userCollection.updateOne(filter,updateDoc,options);
    const token=jwt.sign({email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:"1h"});
    res.send({result,token});
    });



    app.get("/available",async(req,res)=>{
      const date=req.query.date;
      // Step 1: get all services
      const services=await serviceCollection.find().toArray();
      // Step 2: get the bookings of the day            output: [{},{},{},{},{},{},{},{}]
      const query={date:date};
      const bookings=await bookingCollection.find(query).toArray();
      // Step 3: for each service
      services.forEach(service=>{
      // Step 4: find bookings for that service         output: [{},{},{},{}]
      const serviceBookings=bookings.filter(book=>book.treatment===service.name);
      // Step 5: select slots for service bookings
      const bookdedSlots=serviceBookings.map(book=>book.slot);
      // Step 6: select those slot that are not in the bookedslots
      const available=service.slots.filter(slot=>!bookdedSlots.includes(slot));
      service.slots=available;
      });
      res.send(services)
    });

    app.get("/booking",verifyJwt,async(req,res)=>{
      const patient=req.query.patient;
      const decodedEmail=req.decoded.email;
      if(patient==decodedEmail){
        const query={patient:patient}
        const bookings=await bookingCollection.find(query).toArray();
        res.send(bookings);
      }
      else{
        return res.status(403).send({message:"forbidden access"});
      }
     
    })

    app.post("/booking",async(req,res)=>{
      const booking=req.body;
      const query={treatment:booking.treatment,date:booking.date,patient:booking.patient}
      const exists=await bookingCollection.findOne(query);
      if(exists){
        return res.send({success:false,booking:exists})
      }
      const result=await bookingCollection.insertOne(booking);
      return res.send({success:true,result});
    });
  }
  finally{

  }

}

run();

app.get('/', (req, res) => {
  res.send('Hello World from Doctors Portal!')
})

app.listen(port, () => {
  console.log(`Doctors app listening on port ${port}`)
})