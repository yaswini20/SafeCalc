const mongoose=require('mongoose');
module.exports=async function connectDB(){if(!process.env.MONGO_URI)throw new Error('MONGO_URI is not configured.');mongoose.set('strictQuery',true);const conn=await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:10000});console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);return conn;};
