import { db } from "../connect.js"
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateOTP } from '../services/otp.js';
import { sendMail }  from '../services/emailService.js';

export const register = async (req, res) => {
    // Check user if exists
    const q = "SELECT * FROM users WHERE username=?"
    db.query(q, [req.body.username], (err, data) => {
        if (err) return res.status(500).json(err)
        if (data.length) return res.status(409).json('User already exists.')
        console.log(data)

    // Check if email is unique or not
    const q = "SELECT * FROM users WHERE email=?"
    db.query(q, [req.body.email], (err, data) => {
        if (err) return res.status(500).json(err)
        if (data.length) return res.status(409).json('Email already in use.')
        console.log(data)


        //Create a new hashed password
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(req.body.password, salt)
        const otpGenerated = generateOTP();
        const q2 = "INSERT INTO users (`username`, `email`, `password`, `name`, `otp`) VALUES (?)"
        const values = [
            req.body.username, req.body.email, hashedPassword, req.body.name,otpGenerated
        ]
        try {
             sendMail({
              to: req.body.email,
              OTP: otpGenerated,
            });
           // return [true, newUser];
          } catch (error) {
            return  res.status(409).json(`Unable to send email ${error}`);
          }
        db.query(q2, [values], (err, data) => {
            
            if (err) return res.status(500).json(err)
            const token = jwt.sign({ id: data.insertId }, "secretkey")
            console.log(data.insertId)
            // const { password, ...others } = data[0]
            const val={id: data.insertId, username: req.body.username, email: req.body.email, name: req.body.name }
            res.cookie('accessToken', token, {
                httpOnly: true,
            }).status(200).json(val)
        })
    });
    })
}
export const login = (req, res) => {
    const q = "SELECT * FROM users WHERE username=?"
    db.query(q, [req.body.username], (err, data) => {
        if (err) return res.status(500).json(err)
        if (data.length === 0) return res.status(404).json('User not found')

        const checkedPassword = bcrypt.compareSync(req.body.password, data[0].password)

        if (!checkedPassword) return res.status(400).json("Wrong password or username")
        
        const token = jwt.sign({ id: data[0].id, isVerified: data[0].isverified }, "secretkey")

        const { password, otp, ...others } = data[0]

        res.cookie('accessToken', token, {
            httpOnly: true,
        }).status(200).json(others)

    })
}

export const otpVerification = async (req,res) => {
    const q = "SELECT * FROM users WHERE username=?"
    db.query(q, [req.body.username], (err, data) => {
        if (err) return res.status(500).json(err)
        // if (data.length) return res.status(409).json('User already exists.')
        console.log(data)
        console.log(data[0].otp,req.body.otp);
        const { password, otp, ...others } = data[0]

        if(Number(req.body.otp) === data[0].otp) {
            return res.status(200).json(others);
        } else {
            return res.status(400).json("Invalid otp");
        }
    });
}

export const resendOTP = async (req,res) => {
    const q = "SELECT * FROM users WHERE username=?"
    db.query(q, [req.body.username], (err, data) => {
        if (err) return res.status(500).json(err)

        const otpGenerated = generateOTP();
        try {
            sendMail({
             to: data[0].email,
             OTP: otpGenerated,
           });
          // return [true, newUser];
         } catch (error) {
           return  res.status(409).json(`Unable to send email ${error}`);
         }

         const q2 = "UPDATE users SET otp=? WHERE username=?"
         db.query(q2, [otpGenerated ,data[0].username], (err, data) => {
            if (err) return res.status(500).json(err);     
            
            console.log("otp sent again successfully!!!")
        });
    });
}

export const logout = (req, res) => {
    res.clearCookie("accessToken", {
        secure: true,
        sameSite: 'none'
    }).status(200).json("User has been logged out")
}