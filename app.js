const express = require("express");
const NodeCache = require("node-cache");
const extractor = require("./extractor");

const app = express();
const cache = new NodeCache({ stdTTL: 12 * 60 * 60, checkperiod: 5 });

app.get("/", async (req, res, next) => {
  username = req.query.username;
  if (username == "" || username == undefined) {
    res.status(400).send("username required");
    return;
  }

  password = req.query.password;
  if (password == "" || password == undefined) {
    res.status(400).send("password required");
    return;
  }

  filter = req.query.filter;

  let cache_key = username + filter;
  transactions = cache.get(cache_key);
  if (transactions == undefined) {
    console.log("cache miss: fetching data from CEI...");
    try {
      transactions = await extractor.extractTransactions(
        username,
        password,
        filter
      );
      cache.set(cache_key, transactions);
    } catch (e) {
      console.log("error fetching transactions", e);
      next(e);
      return;
    }
  }

  const csv = transactions
    .map(transaction => {
      return transaction
        .map(elem => {
          return `\"${elem}\"`;
        })
        .join(",");
    })
    .join("\n");

  res.send(csv);
});

app.listen(process.env.PORT || 3000);
