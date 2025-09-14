// Note: Install required packages with: npm install node-cron @types/node-cron
import express from 'express';
// import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import * as cron from 'node-cron';
import Iceland from './country/iceland';
import Norway from './country/norway';
import Malta from './country/malta';
import Lithuania from './country/lithuania';
import { type PageWithCursor } from "puppeteer-real-browser";
import Latvia from './country/latvia';
import Italy from './country/italy';
import Hungry from './country/hungry';
import Finland from './country/finland';
import Estonia from './country/estonia';
import Czech from './country/czech';
import Croatia from './country/croatia';
// import ImapService from './services/imap';
import Austria from './country/austria';
import { emails, passwords, vfsPass } from './configs/creds';

// Load environment variables
dotenv.config();

// Configuration options
const EXECUTION_MODE = process.env.EXECUTION_MODE || 'sequential'; // 'sequential' or 'concurrent'
const CONCURRENT_BATCH_SIZE = parseInt(process.env.CONCURRENT_BATCH_SIZE || '3');
const DELAY_BETWEEN_COUNTRIES = parseInt(process.env.DELAY_BETWEEN_COUNTRIES || '8000');
const DELAY_BETWEEN_BATCHES = parseInt(process.env.DELAY_BETWEEN_BATCHES || '15000');

const index = 0

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/visa-server';
// const iceland = new Iceland();

// const norway = new Norway();
// const malta = new Malta();
// const lithuania = new Lithuania();
const latvia = new Latvia();
const italy = new Italy();
const hungry = new Hungry();
const finland = new Finland();
// const estonia = new Estonia();
// const czech = new Czech();
// const croatia = new Croatia();
// const austria = new Austria();
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
    // await mongoose.connect(MONGODB_URI);
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
      // iceland:iceland.slot,
      // norway:norway.slot,
      // malta:malta.slot,
      // lithuania:lithuania.slot,
      latvia:latvia.slot,
      italy:italy.slot,
      hungry:hungry.slot,
      finland:finland.slot,
      // estonia:estonia.slot,
      // czech:czech.slot,
      // croatia:croatia.slot,
      // austria:austria.slot
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
      // iceland.fillOTP(otp)
    }else if(site === "norway"){
      // norway.fillOTP(otp)
    }else if(site === "malta"){
      // malta.fillOTP(otp)
    }else if(site === "lithuania"){
      // lithuania.fillOTP(otp)
    }else if(site === "latvia"){
      latvia.fillOTP(otp)
    }else if(site === "italy"){
      italy.fillOTP(otp)
    }else if(site === "hungry"){
      hungry.fillOTP(otp)
    }else if(site === "finland"){
      finland.fillOTP(otp)
    }else if(site === "estonia"){
      // estonia.fillOTP(otp)
    }else if(site === "czech"){
      // czech.fillOTP(otp)
    }else if(site === "croatia"){
      // croatia.fillOTP(otp)
    }else if(site === "austria"){
      // austria.fillOTP(otp)
    }
    
  } catch (error) {
    console.error('❌ Error handling received OTP:', error);
  }
};

let isCompleted = true
let round = 0
const getEmailPasswordIndex = (index:number)=>{
  let emailIndex = (index + round) % emails.length;
  return [emails[emailIndex], vfsPass[emailIndex]];
}

// Delay function for sequential execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize country with retry mechanism
const initializeCountryWithRetry = async (country: {name:string, instance:Iceland | Norway | Malta | Lithuania | Latvia | Italy | Hungry | Finland | Estonia | Czech | Croatia | Austria, index:number}, maxRetries: number = 2): Promise<void> => {
  let retryCount = 0;
  while (retryCount <= maxRetries) {
    try {
      console.log(`🚀 Initializing ${country.name}... (Attempt ${retryCount + 1}/${maxRetries + 1})`);
      await country.instance.init(...getEmailPasswordIndex(country.index));
      if(country.instance.page?.url().includes("page-not-found")){
        throw new Error("Page not found")
      }
      console.log(`✅ ${country.name} initialized successfully`);
      return; // Success, exit retry loop
    } catch (error) {
      retryCount++;
      console.error(`❌ Error initializing ${country.name} (Attempt ${retryCount}):`, error);
      
      if (retryCount <= maxRetries) {
        const retryDelay = retryCount * 10000; // Increasing delay: 10s, 20s
        console.log(`⏳ Retrying ${country.name} in ${retryDelay / 1000} seconds...`);
        await delay(retryDelay);
      } else {
        console.error(`💀 ${country.name} failed after ${maxRetries + 1} attempts`);
      }
    }
  }
};

// Sequential initialization with delays and error handling
const initializeCountriesSequentially = async (): Promise<void> => {
  try{
  const countries = [
    // { instance: iceland, name: 'Iceland', index: 0 },
    // { instance: norway, name: 'Norway', index: 1 },
    // { instance: malta, name: 'Malta', index: 2 },
    // { instance: lithuania, name: 'Lithuania', index: 3 },
    { instance: latvia, name: 'Latvia', index: 0 },
    { instance: italy, name: 'Italy', index: 1 },
    { instance: hungry, name: 'Hungary', index: 2 },
    { instance: finland, name: 'Finland', index: 3 },
    // { instance: estonia, name: 'Estonia', index: 8 },
    // { instance: czech, name: 'Czech Republic', index: 9 },
    // { instance: croatia, name: 'Croatia', index: 10 },
    // { instance: austria, name: 'Austria', index: 11 }
  ];

  const successfulCountries: string[] = [];
  const failedCountries: string[] = [];
  
  for (const country of countries) {
    try {
      await initializeCountryWithRetry(country);
      successfulCountries.push(country.name);
      
      // Add delay between initializations to prevent rate limiting
      console.log(`⏳ Waiting ${DELAY_BETWEEN_COUNTRIES / 1000}s before next country initialization...`);
      await delay(DELAY_BETWEEN_COUNTRIES);
    } catch (error) {
      console.error(`💀 Final failure for ${country.name}:`, error);
      failedCountries.push(country.name);
      // Continue with next country even if current one fails
    }
  }
  
  console.log(`📊 Initialization Summary:`);
  console.log(`✅ Successful: ${successfulCountries.length} countries - ${successfulCountries.join(', ')}`);
  console.log(`❌ Failed: ${failedCountries.length} countries - ${failedCountries.join(', ')}`);
}catch(err){
  console.error(err)
}
};

// Alternative: Limited concurrent execution (use this for better performance if sequential is too slow)
const initializeCountriesConcurrent = async (concurrencyLimit: number = 3): Promise<void> => {
  const countries = [
    // { instance: iceland, name: 'Iceland', index: 0 },
    // { instance: norway, name: 'Norway', index: 1 },
    // { instance: malta, name: 'Malta', index: 2 },
    // { instance: lithuania, name: 'Lithuania', index: 3 },
    { instance: latvia, name: 'Latvia', index: 0 },
    { instance: italy, name: 'Italy', index: 1 },
    { instance: hungry, name: 'Hungary', index: 2 },
    { instance: finland, name: 'Finland', index: 3 },
    // { instance: estonia, name: 'Estonia', index: 8 },
    // { instance: czech, name: 'Czech Republic', index: 9 },
    // { instance: croatia, name: 'Croatia', index: 10 },
    // { instance: austria, name: 'Austria', index: 11 }
  ];

  // Process countries in batches
  for (let i = 0; i < countries.length; i += concurrencyLimit) {
    const batch = countries.slice(i, i + concurrencyLimit);
    console.log(`🚀 Processing batch ${Math.floor(i / concurrencyLimit) + 1}: ${batch.map(c => c.name).join(', ')}`);
    
    await Promise.all(
      batch.map(country => initializeCountryWithRetry(country).catch(error => {
        console.error(`❌ Batch error for ${country.name}:`, error);
      }))
    );
    
    // Delay between batches
    if (i + concurrencyLimit < countries.length) {
      console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
      await delay(DELAY_BETWEEN_BATCHES);
    }
  }
};

// Cron job function to initialize all countries
const initializeIcelandService = async (): Promise<void> => {
  try {
    console.log(`🕐 Starting countries initialization in ${EXECUTION_MODE} mode...`);
    if(!isCompleted){
      console.log('⏳ Previous initialization still in progress, skipping...');
      return
    }
    isCompleted = false
    
    if (EXECUTION_MODE === 'concurrent') {
      console.log(`🔄 Using concurrent mode with batch size: ${CONCURRENT_BATCH_SIZE}`);
      await initializeCountriesConcurrent(CONCURRENT_BATCH_SIZE);
    } else {
      console.log('📋 Using sequential mode');
      await initializeCountriesSequentially();
    }
    
    isCompleted = true
    round++
    console.log('✅ All countries initialization process completed');
  } catch (error) {
    console.error('❌ Error initializing countries:', error);
    isCompleted = true; // Reset flag even on error
  }
};

// Setup cron job
const setupCronJobs = (): void => {
  // Initialize immediately on startup
  console.log(`🚀 Initializing all countries on startup (Mode: ${EXECUTION_MODE})...`);
  initializeIcelandService();
  
  // Run every 10 minutes: */10 * * * *
   cron.schedule('*/10 * * * *', async () => {
    console.log('⏰ Cron job triggered - Initializing all countries');
    // await initializeIcelandService();
  }, {
    timezone: 'UTC'
  });

  console.log('📅 Cron job scheduled: Countries will initialize every 10 minutes');
  console.log(`⚙️ Configuration: Mode=${EXECUTION_MODE}, Batch Size=${CONCURRENT_BATCH_SIZE}, Country Delay=${DELAY_BETWEEN_COUNTRIES}ms, Batch Delay=${DELAY_BETWEEN_BATCHES}ms`);
};

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    
    // Start IMAP service with callback
    try {
      // const imapServices:ImapService[] = []
      // const promises = emails.map((email, i) => {
      //   const imapService = new ImapService(email, passwords[i])
      //   imapServices.push(imapService)
      //   return imapService.start(handleOtpReceived)
      // })
    
      // Wait for all to connect
      // await Promise.all(promises)
    
      console.log('📧 All IMAP services started successfully');
    } catch (imapError) {
      console.warn('⚠️ IMAP service failed to start:', imapError);
      console.warn('📧 Email monitoring will not be available');
    }

    app.post("/otp",(req,res)=>{
      handleOtpReceived(req.body.otp as string,req.body.site as string);
    })
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      // console.log(`📖 Health check: http://localhost:${PORT}/health`);
      // console.log(`🔑 OTP endpoint: http://localhost:${PORT}/otp`);
      // console.log(`🔧 Manual Iceland trigger: POST http://localhost:${PORT}/iceland/init`);
      // console.log(`📊 Cron status: GET http://localhost:${PORT}/cron/status`);
      
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
  // await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  // await mongoose.connection.close();
  process.exit(0);
});

startServer();

export default app;
