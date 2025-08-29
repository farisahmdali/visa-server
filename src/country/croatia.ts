import { connect, type PageWithCursor } from "puppeteer-real-browser";


 class Croatia {
    page: PageWithCursor | null;
    browser: any;
    capturedHeaders: any;
    capturedRequestBody: any;
    slot: any;
    isFetching: boolean = false;
    currentCenter?:string ;
    status:"otp fill" | "init" | "complete" | "form fill"
    email?: string;
    password?: string;
    constructor() {
        this.page = null;
        this.status = "complete";
        
    }

    async init(email?: string, password?: string) {
        try{

            if(this.status !== "complete") {
                return;

        }
        if(email){
            this.email = email;
        }
        if(password){
            this.password = password;
        }
        this.status = "init";
        const connectOptions: any = {
            headless: false,
            args: [
                '--no-first-run',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-ipc-flooding-protection'
            ],
            customConfig: {},
            turnstile: true, // Keep turnstile automation enabled
            connectOption: {},
            disableXvfb: false,
            ignoreAllFlags: false,
        };
        const connection = await connect(connectOptions);
        this.page = connection.page;
        this.browser = connection.browser;
        this.page.setDefaultTimeout(600000);
        
        // Disable automatic interactions and events
        await this.page.evaluateOnNewDocument(() => {
            // Flag to control when cookie interactions are allowed
            (window as any).allowCookieInteraction = false;
            
            // Prevent automated clicking on cookie banner
            window.addEventListener('load', () => {
                // Disable all interactions with cookie banner initially
                const preventCookieInteraction = (e: Event) => {
                    if (!(window as any).allowCookieInteraction) {
                        const target = e.target as HTMLElement;
                        if (target && (
                            target.id === 'onetrust-accept-btn-handler' ||
                            target.closest('#onetrust-accept-btn-handler') ||
                            target.closest('#onetrust-banner-sdk') ||
                            target.closest('.onetrust-pc-dark-filter')
                        )) {
                            console.log('Prevented automated cookie interaction');
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            return false;
                        }
                    }
                };
                
                // Add listeners for various events that might trigger cookie banner
                ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'keypress'].forEach(eventType => {
                    document.addEventListener(eventType, preventCookieInteraction, true);
                });
            });
        });
        
        await this.page.goto("https://visa.vfsglobal.com/gbr/en/hrv/login");
        console.log("Opened page");
         await this.getClearance(60000);
        console.log("Got clearance");
        console.log("Waiting for network to be idle");
        await this.page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {
            console.log("Network idle timeout, proceeding anyway");
        });
        if(this.email && this.password){
            await this.fillLoginForm(this.email, this.password);
        }
    } catch (error) {
        console.error("❌ Error in init:", error);
        this.status = "complete";
        if (this.page) {
            await this.page.close();
        }
        this.init();
    }
    }

    async getClearance(
        timeout: number
    ) {
        if (!this.page) {
            throw new Error("Page not initialized");
        }
        console.log("Waiting for Cloudflare challenge to complete");
        const timeoutMs = timeout || 60000;
        try {
            await this.page.waitForFunction(
                () => {
                    const el = document.querySelector(
                        'input[name="cf-turnstile-response"], input[id^="cf-chl-widget"][name="cf-turnstile-response"]'
                    ) as HTMLInputElement | null;
                    const token = el?.value || "";
                    const hasCookie = document.cookie.includes("cf_clearance=") || document.cookie.includes("__cf_bm=");
                    return (token && token.length > 10) || hasCookie;
                },
                { timeout: timeoutMs, polling: 500 }
            );
            console.log("Cloudflare challenge completed");
        } catch {
            throw new Error("Cloudflare challenge timeout");
        }

        const cookies = await this.browser.cookies();
        return { cookies, headers: {} };
    }

    async fillLoginForm(email: string, password: string) {
        if (!this.page ) {
            throw new Error("Page not initialized");
        }
        if(this.status !== "init") {
            return;
        }
        this.status = "form fill";
        console.log("Starting form filling process");
        // Handle cookie banner if present - WITH CONTROLLED INTERACTION
        try {
            await this.page.waitForSelector("#onetrust-accept-btn-handler", { timeout: 3000 });
            console.log("Cookie banner found, enabling controlled interaction");
            
            // Enable cookie interaction temporarily
            await this.page.evaluate(() => {
                (window as any).allowCookieInteraction = true;
            });
            
            
            // Use evaluate to click the button to avoid focus issues
            await this.page.evaluate(() => {
                const cookieBtn = document.querySelector("#onetrust-accept-btn-handler") as HTMLElement;
                if (cookieBtn) {
                    console.log("Clicking cookie button with controlled interaction");
                    cookieBtn.click();
                }
            });
            
            // Wait for the banner to disappear
            await this.page.waitForSelector("#onetrust-accept-btn-handler", { hidden: true, timeout: 5000 }).catch(() => {
                console.log("Cookie banner didn't disappear as expected");
            });
            
            // Disable cookie interaction again
            await this.page.evaluate(() => {
                (window as any).allowCookieInteraction = false;
            });
            
            console.log("Cookie banner handled successfully with controlled interaction");
        } catch (e) {
            console.log("No cookie banner found or already accepted");
            // Ensure flag is disabled even if no banner found
            await this.page.evaluate(() => {
                (window as any).allowCookieInteraction = false;
            });
        }
        console.log("Waiting for email field");
        await this.page.waitForSelector("#email", { visible: true, timeout: 10000 });
        await this.page.evaluate((emailValue) => {
            const emailEl = document.querySelector('#email') as HTMLInputElement;
            if (emailEl) {
                emailEl.focus();
                emailEl.value = emailValue;
                emailEl.dispatchEvent(new Event('input', { bubbles: true }));
                emailEl.dispatchEvent(new Event('change', { bubbles: true }));
                emailEl.blur();
            }
        }, email);
        console.log("Waiting for password field");
        await this.page.waitForSelector("#password", { visible: true, timeout: 10000 });

        console.log("Filling password field");
        await this.page.evaluate((passwordValue) => {
            const passwordEl = document.querySelector('#password') as HTMLInputElement;
            if (passwordEl) {
                passwordEl.focus();
                passwordEl.value = passwordValue;
                passwordEl.dispatchEvent(new Event('input', { bubbles: true }));
                passwordEl.dispatchEvent(new Event('change', { bubbles: true }));
                passwordEl.blur();
            }
        }, password);
        const emailFilled = await this.page.$eval('#email', (el) => (el as HTMLInputElement).value.length > 0);
        const passwordFilled = await this.page.$eval('#password', (el) => (el as HTMLInputElement).value.length > 0);

        console.log(`Email filled: ${emailFilled}, Password filled: ${passwordFilled}`);

        if (!emailFilled || !passwordFilled) {
            throw new Error("Form fields not properly filled");
        }
        const clicked = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
            const submitBtn = buttons.find(btn =>
                btn.textContent?.trim().includes('Sign In') ||
                btn.type === 'submit' ||
                btn.getAttribute('mat-stroked-button') !== null
            );
            if (submitBtn && !submitBtn.disabled) {
                submitBtn.click();
                return true;
            }
            return false;
        });
    
        if (!clicked) {
            console.log("Fallback: clicking submit button by selector");
            await this.page.click('button[type="submit"], form button');
        }
    
        console.log("Submit button clicked, waiting for navigation");

    }

    async delay(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async fillOTP(otp: string) {
        if(this.status !== "form fill") {
            return;
        }
        this.status = "otp fill";
        if (!this.page) {
            throw new Error("Page not initialized");
        }
        await this.page.waitForSelector("#mat-input-3", { visible: true });
        await this.page.evaluate((otpValue) => {
            const emailEl = document.querySelector('#mat-input-3') as HTMLInputElement;
            if (emailEl) {
                emailEl.focus();
                emailEl.value = otpValue;
                emailEl.dispatchEvent(new Event('input', { bubbles: true }));
                emailEl.dispatchEvent(new Event('change', { bubbles: true }));
                emailEl.blur();
            }
        }, otp);
        console.log("Filled OTP");
        
        // Wait for turnstile to be completed before clicking submit
        console.log("Waiting for turnstile to be completed...");
        await this.page.waitForFunction(() => {
            // Check if turnstile is completed - look for the success token or completed state
            const turnstileElement = document.querySelector('iframe[src*="turnstile"]');
            if (!turnstileElement) {
                return true; // No turnstile present, can proceed
            }
            
            // Check for turnstile success indicators
            const turnstileContainer = turnstileElement.closest('[data-cf-turnstile-widget-id]');
            if (turnstileContainer) {
                // Check if turnstile has been completed (usually indicated by a success class or data attribute)
                return turnstileContainer.querySelector('[data-cf-turnstile-response]') !== null ||
                       turnstileContainer.classList.contains('cf-turnstile-success') ||
                       turnstileContainer.hasAttribute('data-cf-turnstile-response');
            }
            
            return false;
        }, { timeout: 60000 }); // Wait up to 60 seconds for turnstile completion
        
        console.log("Turnstile completed, proceeding with submit");
        
        const clicked = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
            const submitBtn = buttons.find(btn =>
                btn.textContent?.trim().includes('Sign In') ||
                btn.type === 'submit' ||
                btn.getAttribute('mat-raised-button') !== null
            );
            if (submitBtn && !submitBtn.disabled) {
                submitBtn.click();
                return true;
            }
            return false;
        });
    
        if (!clicked) {
            console.log("Fallback: clicking submit button by selector");
            await this.page.click('button[type="submit"], form button');
        }
        console.log("Clicked submit button");
        await this.page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {
            console.log("Navigation timeout, proceeding anyway");
        })
        console.log("Navigation completed");
        this.getSlotsAvailable(); // Now use API endpoint with date parameter
    }

    async  getSlotsAvailable() {
        try {
            if (!this.page) {
                throw new Error("Page not initialized");
            }
        
        
            console.log("Setting up API response monitoring...");
        
            // Set up response listener for the API call
            this.page.on('response', async (response) => {
                const url = response.url();
                const method = response.request().method();
                const status = response.status();
                const request = response.request();
                if (url.includes('CheckIsSlotAvailable')) {
                    
                    console.log("🎯 API Call Detected!");
                    console.log("URL:", url);
                    console.log("Method:", method);
                    console.log("Status:", status);
        
                    // Capture headers and request body for later use
                    if (method === 'POST' && status >= 200 && status < 400) {
                        try {
                            // Capture request headers
                            this.capturedHeaders = request.headers();
                            console.log("📥 Captured Request Headers:");
                            console.log(JSON.stringify(this.capturedHeaders, null, 2));
        
                            // Capture request body
                            const requestPostData = request.postData();
                            if (requestPostData) {
                                this.capturedRequestBody = JSON.parse(requestPostData);
                                console.log("📥 Captured Request Body:");
                                console.log(JSON.stringify(this.capturedRequestBody, null, 2));
                            }
                        } catch (error) {
                            console.log("⚠️ Error capturing request data:", error);
                        }
                    }
        
                    // Only try to parse response body for non-preflight requests
                    if (method !== 'OPTIONS' && status >= 200 && status < 300) {
                        try {
                            // Check if response has content-length or content-type indicating a body
                            const contentType = response.headers()['content-type'] || '';
                            const contentLength = response.headers()['content-length'];
        
                            if (contentLength === '0' || (!contentType && !contentLength)) {
                                console.log("📋 Response has no body");
                                return;
                            }
        
                            // Try to parse as JSON first
                            if (contentType.includes('application/json')) {
                                const responseData = await response.json();
                                console.log("📋 API Response (JSON):");
                                console.log(JSON.stringify(responseData, null, 2));
                                if(this.currentCenter) {
                                    if (!this.slot) {
                                        this.slot = {};
                                    }
                                    this.slot[this.currentCenter] = responseData;
                                } else {
                                    this.slot = responseData;
                                }
                               
                            } else {
                                // Fallback to text
                                const responseText = await response.text();
                                console.log("📄 API Response (Text):");
                                console.log(responseText);
                            }
                           

                        } catch (error) {
                            console.log("⚠️ Could not parse response body (likely preflight or empty response)");
                            console.log("Error details:", error instanceof Error ? error.message : 'Unknown error');
                        }
                    } else {
                        console.log(`ℹ️ Skipping body parsing for ${method} request with status ${status}`);
                    }
                }
            });
            await this.page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {
                console.log("Network idle timeout, proceeding anyway");
            })
            // await this.page.waitForSelector("body > app-root > div > main > div > app-eligibility-criteria > section > form > mat-card:nth-child(1) > form > div:nth-child(1) > mat-form-field > div.mat-mdc-text-field-wrapper.mdc-text-field.mdc-text-field--outlined.mdc-text-field--no-label", { visible: true, timeout: 10000 });
            console.log("Clicking Start New Booking button...");
            await this.page.click("button.btn-brand-orange");
            // console.log("Waiting for page navigation...");
            // await GlobalPage.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 });
            await this.page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {
                console.log("Network idle timeout, proceeding anyway");
            })
            console.log("Waiting for dropdown to be available...");
             await this.page.waitForSelector('body > app-root > div > main > div > app-eligibility-criteria > section > form > mat-card:nth-child(1) > form > div:nth-child(1) > mat-form-field > div.mat-mdc-text-field-wrapper.mdc-text-field.mdc-text-field--outlined.mdc-text-field--no-label', { visible: true, timeout: 10000 }).catch(() => {
                console.log("Dropdown not available, proceeding anyway");
            })
        
        
            console.log("Clicking on Application Centre dropdown...");
            // Try clicking by the mat-select class first
            await this.page.click('mat-select[formcontrolname="centerCode"]');
            
            // Verify the dropdown was clicked by checking if it's expanded
            const isDropdownOpen = await this.page.evaluate(() => {
                const matSelect = document.querySelector('mat-select[formcontrolname="centerCode"]');
                return matSelect?.getAttribute('aria-expanded') === 'true';
            });
            
            if (isDropdownOpen) {
                console.log("✅ Dropdown click verified - dropdown is expanded (aria-expanded='true')");
            } else {
                console.log("⚠️ Dropdown may not have opened properly - trying trigger class");
                // Try clicking the trigger element directly as fallback
                await this.page.click('.mat-mdc-select-trigger');
                
                // Check again after fallback click
                const isOpenAfterFallback = await this.page.evaluate(() => {
                    const matSelect = document.querySelector('mat-select[formcontrolname="centerCode"]');
                    return matSelect?.getAttribute('aria-expanded') === 'true';
                });
                
                if (isOpenAfterFallback) {
                    console.log("✅ Dropdown opened after trigger click");
                } else {
                    console.log("❌ Dropdown still not opened - trying original selector");
                    await this.page.click('body > app-root > div > main > div > app-eligibility-criteria > section > form > mat-card:nth-child(1) > form > div:nth-child(1) > mat-form-field > div.mat-mdc-text-field-wrapper.mdc-text-field.mdc-text-field--outlined.mdc-text-field--no-label');
                }
            }
        
        

            console.log("Looking for first option in dropdown...");
        // Select the first available option
         // Get options for logging outside of evaluate
         const options = await this.page.evaluate(() => {
            return Array.from(document.querySelectorAll('mat-option')).map(option => option.textContent?.trim() || '');
        });
        console.log("Found options:", options);
        for(let i = 0; i < options.length; i++) {
            this.currentCenter = options[i];
            const optionSelected = await this.page.evaluate((index) => {
                const options = Array.from(document.querySelectorAll('mat-option'));
                if (options.length > index) {
                    const option = options[index];
                    if (option) {
                        const text = option.textContent?.trim() || '';
                        console.log("Selecting option:", text);
                        (option as HTMLElement).click();
                        return true;
                    }
                }
                return false;
            }, i);
        
       
        
            if (optionSelected) {
                console.log("✅ Successfully selected application center option");
        
               
        
                // console.log("Waiting for appointment category dropdown to become available...");
                // await this.page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {
                //     console.log("Network idle timeout, proceeding anyway");
                // })
        
                // Check if the next dropdown (appointment category) becomes available
                try {
                    // await this.page.waitForSelector('mat-select[formcontrolname="selectedSubvisaCategory"]:not(.mat-mdc-select-disabled)', {
                    //     visible: true,
                    //     timeout: 10000
                    // });
                    // console.log("✅ Appointment category dropdown became available");
                    
                    // // Click on appointment category dropdown
                    // console.log("Clicking on appointment category dropdown...");
                    // await this.page.click('mat-select[formcontrolname="selectedSubvisaCategory"]');
                  
                    
                    // // Select option with keyword "schengen"
                    // const schengonSelected = await this.page.evaluate(() => {
                    //     const options = Array.from(document.querySelectorAll('mat-option'));
                    //     for (const option of options) {
                    //         const text = option.textContent?.toLowerCase().trim() || '';
                    //         if (text.includes('schengen')) {
                    //             console.log("Selecting schengen option:", text);
                    //             (option as HTMLElement).click();
                    //             return true;
                    //         }
                    //     }
                    //     return false;
                    // });
                    
                        
                        // Wait for sub-category dropdown to become available
                        console.log("Waiting for sub-category dropdown to become available...");
                        await this.page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {
                            console.log("Network idle timeout, proceeding anyway");
                        })
                        try {
                            await this.page.waitForSelector('mat-select[formcontrolname="visaCategoryCode"]:not(.mat-mdc-select-disabled)', {
                                visible: true,
                                timeout: 10000
                            });
                            console.log("✅ Sub-category dropdown became available");
                            
                            // Click on sub-category dropdown
                            console.log("Clicking on sub-category dropdown...");
                            await this.page.click('mat-select[formcontrolname="visaCategoryCode"]');
                          
                            
                            // Select option with keyword "tourist"
                            const touristSelected = await this.page.evaluate(() => {
                                const options = Array.from(document.querySelectorAll('mat-option'));
                                for (const option of options) {
                                    const text = option.textContent?.toLowerCase().trim() || '';
                                    if (text.includes('other')) {
                                        console.log("Selecting tourist option:", text);
                                        (option as HTMLElement).click();
                                        return true;
                                    }
                                }
                                return false;
                            });
                            
                            if (touristSelected) {
                                console.log("✅ Successfully selected tourist option");
                                
                            } else {
                                console.log("❌ Could not find tourist option in sub-category");
                                // Log available options for debugging
                                const availableSubOptions = await this.page.evaluate(() => {
                                    const options = Array.from(document.querySelectorAll('mat-option'));
                                    return options.map(option => option.textContent?.trim() || '');
                                });
                                console.log("Available sub-category options:", availableSubOptions);
                                await this.page.click('mat-option:first-child').catch(() => {
                                    console.log("Could not click first option, proceeding anyway");
                                }).catch(() => {
                                    console.log("Could not click first option, proceeding anyway");
                                })
                            }
                            
                        } catch (error) {
                            console.log("⚠️ Sub-category dropdown didn't become available");
                        }
                        
                   
                    
                } catch (error) {
                    console.log("⚠️ Appointment category dropdown didn't become available");
                }
        
            } else {
                console.log("❌ Could not find first option. Available options:");
        
                // Log all available options for debugging
                const availableOptions = await this.page.evaluate(() => {
                    const options = Array.from(document.querySelectorAll('mat-option'));
                    return options.map(option => option.textContent?.trim() || '');
                });
        
                console.log(availableOptions);
        
                // Try to click the first option as fallback
                if (availableOptions.length > 0) {
                    console.log("Clicking first option as fallback...");
                    await this.page.click('mat-option:first-child').catch(() => {
                                    console.log("Could not click first option, proceeding anyway");
                                });
                }
            }
            await this.page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {
                console.log("Network idle timeout, proceeding anyway");
            })
            // Scroll to top of the page to ensure elements are in view
            await this.page.evaluate(() => {
                window.scrollTo(0, 0);
            });
            await this.delay(2000);
            console.log("📜 Scrolled to top of page");
            await this.page.click('mat-select[formcontrolname="centerCode"]');
            
            // Verify the dropdown was clicked by checking if it's expanded
            const isDropdownOpen = await this.page.evaluate(() => {
                const matSelect = document.querySelector('mat-select[formcontrolname="centerCode"]');
                return matSelect?.getAttribute('aria-expanded') === 'true';
            });
            
            if (isDropdownOpen) {
                console.log("✅ Dropdown click verified - dropdown is expanded (aria-expanded='true')");
            } else {
                console.log("⚠️ Dropdown may not have opened properly - trying trigger class");
                // Try clicking the trigger element directly as fallback
                await this.page.click('.mat-mdc-select-trigger');
                
                // Check again after fallback click
                const isOpenAfterFallback = await this.page.evaluate(() => {
                    const matSelect = document.querySelector('mat-select[formcontrolname="centerCode"]');
                    return matSelect?.getAttribute('aria-expanded') === 'true';
                });
                
                if (isOpenAfterFallback) {
                    console.log("✅ Dropdown opened after trigger click");
                } else {
                    console.log("❌ Dropdown still not opened - trying original selector");
                    await this.page.click('body > app-root > div > main > div > app-eligibility-criteria > section > form > mat-card:nth-child(1) > form > div:nth-child(1) > mat-form-field > div.mat-mdc-text-field-wrapper.mdc-text-field.mdc-text-field--outlined.mdc-text-field--no-label');
                }
            }
        }
            console.log("✅ Form selection process completed");
            if(this.page) {
                this.page.close();
            }
        
            this.status = "complete";
        } catch (error) {
            console.error("❌ Error in getSlotsAvailable:", error);
            this.status = "complete";
            if (this.page) {
                await this.page.close();
            }
        }
    }
}

export default Croatia;