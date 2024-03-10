import 'dotenv/config';
import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";

// require('dotenv').config();
// const express= require("express");
// const bodyParser =require("body-parser");
//  const { dirname } =require ("path");
//  const { fileURLToPath } =require("url");
//  const pg =require("pg");
//  const bcryptjs =require ("bcryptjs");
//  const passport =require ("passport");
//  const { Strategy } =require ("passport-local");
//  const session = require("express-session");
 


const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.env.SERVER_PORT;
const saltRounds = 10;


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.urlencoded({ extended: true }));
//app.use(express.static("public"));



const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PWD,
  port: process.env.PG_PORT,
  ssl: true,
});
db.connect();

app.get("/",async (req,res)=>{
//      await db.query("CREATE TABLE users_calculator(id SERIAL PRIMARY KEY,email VARCHAR(100) NOT NULL UNIQUE,password VARCHAR(100) );");
//    await db.query("CREATE TABLE records_calculator(id SERIAL PRIMARY KEY,email VARCHAR(100) NOT NULL,expression VARCHAR(100))");
    res.sendFile(__dirname+"/home.html");
    //
})
app.get("/login",(req,res)=>{
    if(req.session.messages!=null)
    {
        let msg=req.session.messages[0];
        res.render("login.ejs",{message:msg});
    }
    else{
        res.render("login.ejs");
    }
    
})

app.get("/signup",(req,res)=>{
    res.render("signup.ejs");
})

app.get("/calculator", async (req, res) => {
    console.log("in app.get calculator",req.user);
  
    try { 
        if (req.isAuthenticated()) {
        
            res.render("calculator.ejs");
    
        } 
        else {
        res.redirect("/login");
        }
    }
    catch (err) {
        console.log(err);
      }
  });

  app.get("/history",async (req,res)=>{
   console.log("in history get");
    if (req.isAuthenticated()) {
            let email=req.user.email;
            try {
            let output=await db.query("SELECT * FROM records_calculator WHERE email=$1",[email]);
            if (output.rows.length > 0) {
                res.render("history.ejs",{list: output.rows});
                
            } else {
                res.render("history.ejs");
            }
            
                
            } catch (err) {
            console.log(err);
            }
      } else {
        res.redirect("/login");
      }


  })
  app.get("/logout", (req, res) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  });

  app.post(
    "/login",
    passport.authenticate("local", {
      successRedirect: "/calculator",
      failureRedirect: "/login",
      failureMessage:true,
    }),
    //passport.authenticate('local', { failureFlash: 'Invalid username or password.' })
  );

app.post("/signup", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
    try {
      const checkResult = await db.query("SELECT * FROM users_calculator WHERE email = $1", [
        email,
      ]);
  
      if (checkResult.rows.length > 0) {
  
        res.render("login.ejs",{ message: "User already exists. Please LogIn." });
      } else {
        
          bcrypt.hash(password, saltRounds, async (err, hash) => {
            if (err) {
              console.error("Error hashing password:", err);
            } else {
              const result = await db.query(
                "INSERT INTO users_calculator (email , password) VALUES ($1, $2) RETURNING *",
                [email,hash]
              );
              const user = result.rows[0];
              console.log("here",user);
              req.login(user, (err) => {
                if(err)
                {
                  console.log(err);
                }
                console.log("success");
                res.redirect("/calculator");
              });
            }
          });
     
        
      // bcryptjs.hash(password, saltRounds, async (err, hash) => {
      //   if (err) {
      //     console.error("Error hashing password:", err);
      //   } else {
      //     const result = await db.query(
      //       "INSERT INTO users_calculator (email , password) VALUES ($1, $2) RETURNING *",
      //       [email,hash]
      //     );
      //     const user = result.rows[0];
      //     console.log("here",user);
      //     req.login(user, (err) => {
      //       if(err)
      //       {
      //         console.log(err);
      //       }
      //       console.log("success");
      //       res.redirect("/calculator");
      //     });
      //   }
      // });


      }
    } catch (err) {
      console.log(err);
    }
  });
app.post("/calculator",async (req,res)=>{
    let s=req.body.display;
    let email=req.user.email;
    // console.log("yes");
    // console.log(req.user);
    
    if (req.isAuthenticated()) {
        try {
          //add the data into records
          if(s.length>0)
          {
            await db.query("INSERT INTO records_calculator (email , expression) VALUES ($1, $2) ",
          [email,s]);
          }
          
          //res.render("calculator.ejs");
          res.status(204).send();
           
          
        } catch (err) {
          console.log(err);
        }
      } else {
        res.redirect("/login");
      }
})

app.get("/delete/:id", async (req,res)=>{
    const id = parseInt(req.params.id);
        try {
            if (req.isAuthenticated()) {
                await db.query("DELETE FROM records_calculator WHERE id=$1 ;", [id]);
                res.redirect("/history");
            }
            else{
                res.redirect("/login");
            }
          
      
      
        } catch (error) {
          console.log(error);
          res.status(500).json({ message: "Error deleting record" });
        }
    });


passport.use(
    "local",
    new Strategy(async function verify(username, password, cb) {
      try {
        console.log("here");
        const result = await db.query("SELECT * FROM users_calculator WHERE email = $1 ", [
          username,
        ]);
        if (result.rows.length > 0) {
          const user = result.rows[0];
        //   console.log("in login stragey",user,username,password);
          const storedHashedPassword = user.password;
          bcrypt.compare(password, storedHashedPassword, (err, valid) => {
            if (err) {
              console.error("Error comparing passwords:", err);
              return cb(err);
            } else {
              if (valid) {
                
                return cb(null, user);
              } else {
                console.log("here");
                return cb(null, false,{ message: 'Incorrect username or password.' });
              }
            }
          });
        } else {
            console.log("here");
          return cb(null,false,{ message: 'Incorrect username or password.' });
        }
      } catch (err) {
        console.log(err);
      }
    })
  );
  
  passport.serializeUser((user, cb) => {
    cb(null, user);
  });
  
  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });
  
 
  
app.listen(port,()=>{
    console.log(`server listening at port ${port}`);
})
//module.exports=app;
export default app;