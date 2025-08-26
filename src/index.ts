// Note: Install required packages with: npm install node-cron @types/node-cron
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import * as cron from 'node-cron';
import Iceland from './country/iceland';
import { startImapService } from './services/imap';
import Norway from './country/norway';
import Malta from './country/malta';
import Lithuania from './country/lithuania';
import Latvia from './country/latvia';
import Italy from './country/italy';
import Hungry from './country/hungry';
import Finland from './country/finland';
import Estonia from './country/estonia';
import Czech from './country/czech';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/visa-server';
const email = process.env.VFS_EMAIL || 'farisahmdali@gmail.com';
const password = process.env.VFS_PASS || 'farisahmdali@gmail.com';
const iceland = new Iceland(email, password);
const norway = new Norway(email, password);
const malta = new Malta(email, password);
const lithuania = new Lithuania(email, password);
const latvia = new Latvia(email, password);
const italy = new Italy(email, password);
const hungry = new Hungry(email, password);
const finland = new Finland(email, password);
const estonia = new Estonia(email, password);
const czech = new Czech(email, password);
// Store the latest OTP received from email
let latestOtp: string | null = null;
let otpTimestamp: Date | null = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Welcome to Visa Server API',
    version: '1.0.0',
    data:{
      iceland:iceland.slot,
      norway:norway.slot,
      malta:malta.slot,
      lithuania:lithuania.slot,
      latvia:latvia.slot,
      italy:italy.slot,
      hungry:hungry.slot,
      finland:finland.slot,
      estonia:estonia.slot,
      czech:czech.slot
    }
  });
});



// OTP callback function for IMAP service
const handleOtpReceived = async (otp: string,site:string): Promise<void> => {
  try {
    latestOtp = otp;
    otpTimestamp = new Date();
    
    console.log(`🔑 OTP received from email: ${otp}`);
    console.log(`📧 OTP stored and available at: http://localhost:${PORT}/otp`);
    if(site === "iceland"){
      iceland.fillOTP(otp)
    }else if(site === "norway"){
      norway.fillOTP(otp)
    }else if(site === "malta"){
      malta.fillOTP(otp)
    }else if(site === "lithuania"){
      lithuania.fillOTP(otp)
    }else if(site === "latvia"){
      latvia.fillOTP(otp)
    }else if(site === "italy"){
      italy.fillOTP(otp)
    }else if(site === "hungry"){
      hungry.fillOTP(otp)
    }else if(site === "finland"){
      finland.fillOTP(otp)
    }else if(site === "estonia"){
      estonia.fillOTP(otp)
    }else if(site === "czech"){
      czech.fillOTP(otp)
    }
    
  } catch (error) {
    console.error('❌ Error handling received OTP:', error);
  }
};

// Cron job function to initialize Iceland service
const initializeIcelandService = async (): Promise<void> => {
  try {
    console.log('🕐 Starting Iceland service initialization...');
    // await iceland.init();
    // await norway.init();
    // await malta.init();
    // await lithuania.init();
    // await latvia.init();
    // await italy.init();
    // await hungry.init();
    // await finland.init();
    // await estonia.init();
    await czech.init();
    console.log('✅ Iceland service initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Iceland service:', error);
  }
};

// Setup cron job
const setupCronJobs = (): void => {
  // Initialize immediately on startup
  console.log('🚀 Initializing Iceland service on startup...');
  initializeIcelandService();
  
  // Run every 5 minutes: */5 * * * *
   cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Cron job triggered - Initializing Iceland service');
    await initializeIcelandService();
  }, {
    timezone: 'UTC'
  });

  console.log('📅 Cron job scheduled: Iceland service will initialize every 5 minutes');
};

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    
    // Start IMAP service with callback
    try {
      await startImapService(handleOtpReceived);
      console.log('📧 IMAP service started successfully');
    } catch (imapError) {
      console.warn('⚠️ IMAP service failed to start:', imapError);
      console.warn('📧 Email monitoring will not be available');
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📖 Health check: http://localhost:${PORT}/health`);
      console.log(`🔑 OTP endpoint: http://localhost:${PORT}/otp`);
      console.log(`🔧 Manual Iceland trigger: POST http://localhost:${PORT}/iceland/init`);
      console.log(`📊 Cron status: GET http://localhost:${PORT}/cron/status`);
      
      // Setup cron jobs after server starts
      setupCronJobs();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

startServer();

export default app;
