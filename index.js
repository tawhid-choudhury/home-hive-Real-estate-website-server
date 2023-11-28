require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173", "https://homehive-84c83.web.app"],
    credentials: true,
  })
);

// HomeHive
// Il1LGGqlm76OFtfM

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

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

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

    app.get("/homepageReviews", async (req, res) => {
      const cursor = reviewCollection.find().sort({ timestamp: -1 });
      const result = await cursor.limit(8).toArray();
      return res.send(result);
    });

    app.delete("/allreviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });

    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await wishlistCollection.deleteOne(query);
      res.send(result);
    });
  } catch (err) {
    console.log(err);
  }
}
run().catch(console.dir);
