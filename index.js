require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_SK);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://homehive-84c83.web.app"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  return res.send("HOMEHIVE Server Running");
});
app.listen(port, () => {
  console.log(`http://localhost:${port}/`);
});

const uri = `${process.env.MDB_URI}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
    sameSite: "none",
  },
});

async function run() {
  try {
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log(req.body);

      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SEC, {
        expiresIn: "1h",
      });

      return res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("Logged Out___________", user);
      return res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    const database = client.db("homeHiveDB");
    const usersCollection = database.collection("usersCollection");
    const propertiesCollection = database.collection("propertiesCollection");
    const reviewCollection = database.collection("reviewCollection");
    const wishlistCollection = database.collection("wishlistCollection");
    const boughtCollection = database.collection("boughtCollection");

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/addreview", async (req, res) => {
      console.log(req.body);
      const review = req.body;
      review.timestamp = Date.now();
      const result = await reviewCollection.insertOne(review);
      return res.send(result);
    });

    app.post("/wishlist", async (req, res) => {
      console.log(req.body);
      const item = req.body;
      item.timestamp = Date.now();
      const result = await wishlistCollection.insertOne(item);
      return res.send(result);
    });

    app.post("/bought", async (req, res) => {
      console.log(req.body);
      const item = req.body;
      item.timestamp = Date.now();
      const result = await boughtCollection.insertOne(item);
      return res.send(result);
    });

    app.post("/allProperties", async (req, res) => {
      console.log(req.body);
      const item = req.body;
      item.timestamp = Date.now();
      const result = await propertiesCollection.insertOne(item);
      return res.send(result);
    });

    app.patch("/bought/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updateditem = req.body;
      console.log(updateditem);
      const item = {
        $set: {
          transactionId: updateditem.transactionId,
          status: updateditem.status,
          PaymentTimestamp: Date.now(),
        },
      };
      const result = await boughtCollection.updateOne(filter, item, options);
      res.send(result);
    });

    app.patch("/rejectOffer/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updateditem = req.body;
      console.log(updateditem);
      const item = {
        $set: {
          status: updateditem.status,
          RejectTimestamp: Date.now(),
        },
      };
      const result = await boughtCollection.updateOne(filter, item, options);
      res.send(result);
    });

    app.patch("/acceptOffer/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updateditem = req.body;
      console.log(updateditem);
      const item = {
        $set: {
          status: updateditem.status,
          AcceptTimestamp: Date.now(),
        },
      };
      const resultAccept = await boughtCollection.updateOne(
        filter,
        item,
        options
      );

      const propertyId = req.body.propertyId;
      const rejectFilter = {
        _id: { $ne: new ObjectId(id) },
        propertyId: propertyId,
        status: "pending",
      };
      const rejectedItem = {
        $set: {
          status: "rejected",
          RejectTimestamp: Date.now(),
        },
      };
      const resultReject = await boughtCollection.updateMany(
        rejectFilter,
        rejectedItem
      );

      res.send({
        accepted: resultAccept.modifiedCount,
        rejected: resultReject.modifiedCount,
      });
    });

    app.patch("/updateProperty/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: false };
      const updatedProperty = req.body;
      console.log(updatedProperty);
      const property = {
        $set: {
          propertyImage: updatedProperty.propertyImage,
          propertyTitle: updatedProperty.propertyTitle,
          propertyLocation: updatedProperty.propertyLocation,
          priceRange: updatedProperty.priceRange,
          priceMin: updatedProperty.priceMin,
          priceMax: updatedProperty.priceMax,
          description: updatedProperty.description,
        },
      };
      const result = await propertiesCollection.updateOne(
        filter,
        property,
        options
      );
      return res.send(result);
    });

    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const exists = await usersCollection.findOne(query);
      if (exists) {
        return res.send(exists);
      }
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      );
      return res.send(result);
    });

    app.get("/getuser/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      return res.send(result);
    });

    app.get("/propertydetails/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertiesCollection.findOne(query);
      return res.send(result);
    });

    app.get("/allProperties", async (req, res) => {
      let query = {};
      if (req.query?.verificationStatus) {
        query = { verificationStatus: req.query.verificationStatus };
      }
      if (req.query?.featured) {
        query = { featured: req.query.featured };
      }
      if (req.query?.agentEmail) {
        query = { agentEmail: req.query.agentEmail };
      }

      const cursor = propertiesCollection.find(query);
      const result = await cursor.toArray();
      return res.send(result);
    });

    app.get("/allreviews", async (req, res) => {
      let query = {};
      if (req.query?.propertyId) {
        query = { propertyId: req.query.propertyId };
      }
      if (req.query?.email) {
        query = { reviewerEmail: req.query.email };
      }
      const cursor = reviewCollection.find(query);
      const result = await cursor.toArray();
      return res.send(result);
    });
    app.get("/wishlist", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { buyerEmail: req.query.email };
      }
      const cursor = wishlistCollection.find(query);
      const result = await cursor.toArray();
      return res.send(result);
    });

    app.get("/bought", async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { buyerEmail: req.query.email };
      }
      if (req.query?.agentEmail) {
        query = { agentEmail: req.query.agentEmail };
      }
      const cursor = boughtCollection.find(query);
      const result = await cursor.toArray();
      return res.send(result);
    });

    app.get("/payment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await boughtCollection.findOne(query);
      return res.send(result);
    });

    app.get("/homepageReviews", async (req, res) => {
      const cursor = reviewCollection.find().sort({ timestamp: -1 });
      const result = await cursor.limit(8).toArray();
      return res.send(result);
    });

    app.delete("/allreviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.deleteOne(query);
      return res.send(result);
    });

    app.delete("/allproperty/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertiesCollection.deleteOne(query);
      return res.send(result);
    });

    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await wishlistCollection.deleteOne(query);
      return res.send(result);
    });
  } catch (err) {
    console.log(err);
  }
}
run().catch(console.dir);
