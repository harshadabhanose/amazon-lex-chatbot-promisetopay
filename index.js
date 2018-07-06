'use strict';
var g_paymentDate, g_noOfInstallments, g_paymentFrequency;

// --------------- Helpers to build responses which match the structure of the necessary dialog actions -----------------------

function elicitSlot(sessionAttributes, intentName, slots, slotToElicit, message, responseCard) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'ElicitSlot',
            intentName,
            slots,
            slotToElicit,
            message,
            responseCard,
        },
    };
}

function elicitIntent(sessionAttributes, message, responseCard) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'ElicitIntent',
            message,
            responseCard,
        },
    };
}

function close(sessionAttributes, fulfillmentState, message, responseCard) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Close',
            fulfillmentState,
            message,
            responseCard,
        },
    };
}

function delegate(sessionAttributes, slots) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Delegate',
            slots,
        },
    };
}

function buildValidationResult(isValid, violatedSlot, messageContent) {
    return {
        isValid,
        violatedSlot,
        message: { contentType: 'PlainText', content: messageContent },
    };
}

// Build a responseCard with a title, subtitle, and an optional set of options which should be displayed as buttons.
function buildResponseCard(title, subTitle, options, imageUrl) {
    let buttons = null;
    if (options != null) {
        buttons = [];
        for (let i = 0; i < Math.min(5, options.length); i++) {
            buttons.push(options[i]);
        }
    }
    return {
        contentType: 'application/vnd.amazonaws.card.generic',
        version: 1,
        genericAttachments: [{
            title,
            subTitle,
            imageUrl,
            buttons,
        }],
    };
}

// Build a list of potential options for a given slot, to be used in responseCard generation.
function buildOptions(slottype) {
    if (slottype === 'defaultReason') {
        return [
            { text: 'Medical Emergency', value: 'Medical Emergency' },
            { text: 'Loss of Job', value: 'Loss of Job' },
            { text: 'Unforeseen Expenses', value: 'Unforeseen Expenses' },
            { text: 'Other', value: 'Other' },
        ];
    } else if (slottype === 'paymentFrequency') {
        return [
            { text: 'Weekly', value: 'Weekly' },
            { text: 'Bi-monthly', value: 'Bi-monthly' }
        ];
    } else if (slottype === 'agreement') {
        return [
            { text: 'Agree', value: 'Agree' },
            { text: 'Disagree', value: 'Disagree' }
        ];
    } else if (slottype === 'paymentMethod') {
        return [
            {text: 'One Time Payment', value: 'One Time Payment'},
            {text: 'Installments', value: 'Installments'}
        ];
    }
}

// ---------------- Helper Functions --------------------------------------------------

function formatDate(date) {
    var month_names = ["January", "February", "March", 
    "April", "May", "June", "July", "August", "September", 
    "October", "November", "December"];
    
    var dateParts = date.split('-');
    var day = dateParts[2];
    var month = month_names[dateParts[1]-1];
    var year = dateParts[0];
    
    return day + ' ' + month + ' ' + year;
}

function parseLocalDate(date) {
    /**
     * Construct a date object in the local timezone by parsing the input date string, assuming a YYYY-MM-DD format.
     * Note that the Date(dateString) constructor is explicitly avoided as it may implicitly assume a UTC timezone.
     */
    const dateComponents = date.split(/\-/);
    return new Date(dateComponents[2], dateComponents[1] - 1, dateComponents[0]);
}

function isValidDate(date) {
    try {
        return !(isNaN(parseLocalDate(date).getTime()));
    } catch (err) {
        return false;
    }
}

function isValidPhone(phone) {
    var phoneno = /^\d{10}$/;
    if(phone.match(phoneno))
        return true;
    return false;
}

function isValidOTP(otp) {
    var otpno = /^\d{4}$/;
    if(otp.match(otpno))
        return true;
    return false;
}

function validateCollections(phone, otp, defaultReason, paymentDate, noOfInstallments, paymentFrequency, agreement) {
    const defaultReasonTypes = ['medical emergency', 'loss of job', 'unforeseen expenses', 'other'];
    
    if (phone && !isValidPhone(phone)) {
        return buildValidationResult(false, 'phone', 'Please enter a valid 10 digit mobile number');
    }
    
    if (otp && !isValidOTP(otp)) {
        return buildValidationResult(false, 'otp', 'Please enter a valid 4 digit OTP');
    }
    
    if (defaultReason && defaultReasonTypes.indexOf(defaultReason.toLowerCase()) === -1) {
        return buildValidationResult(false, 'defaultReason', buildOptions('defaultReason'));
    }
    
    return buildValidationResult(true, null, null);
}

function validateInstallments(noOfInstallments, paymentFrequency, paymentDate, agreement) {
    const paymentFrequencyTypes = ['weekly', 'bi-monthly'];
    const agreementTypes = ['agree', 'disagree'];
    
    if (noOfInstallments && (noOfInstallments > 6)) {
        return buildValidationResult(false, 'noOfInstallments', `How many installments do you prefer? [min 2 - max 6]`);
    }
    
    if (noOfInstallments && (noOfInstallments < 2)) {
        return buildValidationResult(false, 'noOfInstallments', `How many installments do you prefer?  [min 2 - max 6]`);
    }
    
    if (paymentFrequency && paymentFrequencyTypes.indexOf(paymentFrequency.toLowerCase()) === -1) {
        return buildValidationResult(false, 'paymentFrequency', buildOptions('paymentFrequency'));
    }
    
    if (paymentDate && !isValidDate(paymentDate)) {
        return buildValidationResult(false, 'paymentDate', `Please enter a valid date`);
    }
    
    if (paymentDate && ((new Date(paymentDate) - new Date())/(1000*60*60*24) > 7)) {
        return buildValidationResult(false, 'paymentDate', `Sorry, as per policy, please provide a date within next 7 days.`);
    }
    
    if (paymentDate && (paymentDate < new Date())) {
        return buildValidationResult(false, 'paymentDate', `Sorry, please provide current or future date within next 7 days.`);
    }
    
    if (agreement && agreementTypes.indexOf(agreement.toLowerCase()) === -1) {
        return buildValidationResult(false, 'agreement', buildOptions('agreement'));
    }
    
    return buildValidationResult(true, null, null);
}

function validateOneTimePayment(paymentDate) {
    if (paymentDate && !isValidDate(paymentDate)) {
        return buildValidationResult(false, 'paymentDate', `Please enter a valid date`);
    }
    
    if (paymentDate && ((new Date(paymentDate) - new Date())/(1000*60*60*24) > 7)) {
        return buildValidationResult(false, 'paymentDate', `Sorry, as per policy, please provide a date within next 7 days. [Example: 15 July / Coming Sunday / Tomorrow]`);
    }
    
    return buildValidationResult(true, null, null);
}

//Intent handlers
function handleCollections(intentRequest, callback) {
    const clientPhone = intentRequest.currentIntent.slots.phone;
    const clientOTP = intentRequest.currentIntent.slots.otp;
    const clientDefaultReason = intentRequest.currentIntent.slots.defaultReason;
    
    const source = intentRequest.invocationSource;
    const outputSessionAttributes = intentRequest.sessionAttributes || {};

    if (source === 'DialogCodeHook') {
        console.log(`intentRequest: ${JSON.stringify(intentRequest)}`);
        const slots = intentRequest.currentIntent.slots;
        const validationResult = validateCollections(clientPhone, clientOTP, clientDefaultReason);
        if (!validationResult.isValid) {
            slots[`${validationResult.violatedSlot}`] = null;
            callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, 
                                slots, validationResult.violatedSlot, validationResult.message, 
                                buildResponseCard(validationResult.message.content, ' ',
                                buildOptions(validationResult.violatedSlot), null)));
            return;
        }
        
        if (clientDefaultReason) {
            callback(elicitIntent(outputSessionAttributes, 
                                    { 
                                        contentType: 'PlainText', 
                                        content: 'I understand. How do you wish to pay back the overdue amount?' 
                                    }, 
                                    buildResponseCard('Payment Method', 'Please Select', buildOptions('paymentMethod'), 'https://www.tcaloans.com/wp-content/uploads/installment-loans-vs-single-payment-loans.jpg')));
            return;
        }
        
        callback(delegate(outputSessionAttributes, slots));
        return;
    }
}

function handleInstallments(intentRequest, callback) {
    var clientInstallments = intentRequest.currentIntent.slots.noOfInstallments;
    var clientPaymentFrequency = intentRequest.currentIntent.slots.paymentFrequency;
    var clientPaymentDate = intentRequest.currentIntent.slots.paymentDate;
    var clientAgreement = intentRequest.currentIntent.slots.agreement;
    
    const source = intentRequest.invocationSource;
    const outputSessionAttributes = intentRequest.sessionAttributes || {};

    if (source === 'DialogCodeHook') {
        console.log(`intentRequest: ${JSON.stringify(intentRequest)}`);
        const slots = intentRequest.currentIntent.slots;
        const validationResult = validateInstallments(clientInstallments, clientPaymentFrequency, clientPaymentDate, clientAgreement);
        if (!validationResult.isValid) {
            slots[`${validationResult.violatedSlot}`] = null;
            callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, 
                                slots, validationResult.violatedSlot, validationResult.message, 
                                buildResponseCard(validationResult.message.content, ' ',
                                buildOptions(validationResult.violatedSlot), null)));
            return;
        }
        
        if (clientPaymentDate && !clientAgreement)  {
            g_noOfInstallments = clientInstallments;
            g_paymentFrequency = clientPaymentFrequency;
            g_paymentDate = formatDate(clientPaymentDate);
            const installmentAmount = 60000 / clientInstallments;
            const frequency = clientPaymentFrequency === 'Weekly' ? 7 : 15; 
            callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, intentRequest.currentIntent.slots, 
                            'agreement', { 
                                contentType: 'PlainText', 
                                content: `You need to pay Rs. ${installmentAmount} every ${frequency} days starting from ${g_paymentDate} in ${clientInstallments} installments.` 
                            }, buildResponseCard('Do you agree?', 'Please select', buildOptions('agreement'), 'https://i1.wp.com/plumcrazyaboutcoupons.com/wp-content/uploads/2016/01/agree-to-disagree.jpg?w=650&ssl=1')));
            return;
        }
        if (clientAgreement) {
            if (clientAgreement === 'Agree') {
                callback(close(outputSessionAttributes, 'Fulfilled', 
                                { 
                                    contentType: 'PlainText', 
                                    content: `Mr. John, you agree to pay overdue amount by ${g_noOfInstallments} ${g_paymentFrequency} installments starting from ${g_paymentDate}. I am sending you summary of our conversation through email. Thank you for your time.`
                                }));
            } else {
                callback(elicitIntent(outputSessionAttributes, 
                                    { 
                                        contentType: 'PlainText', 
                                        content: `No problem Mr. John. Let's reschedule the payment. How do you wish to pay back the overdue amount?` 
                                    }, 
                                    buildResponseCard('Payment Method', 'Please Select', buildOptions('paymentMethod'), 'https://www.tcaloans.com/wp-content/uploads/installment-loans-vs-single-payment-loans.jpg')));
                return;
            }
        }
        callback(delegate(outputSessionAttributes, slots));
        return;
    }
}

function handleOneTimePayment(intentRequest, callback) {
    var clientPaymentDate = intentRequest.currentIntent.slots.paymentDate;
    
    const outputSessionAttributes = intentRequest.sessionAttributes || {};
    const source = intentRequest.invocationSource;
    
    if (source === 'DialogCodeHook') {
        console.log(`intentRequest: ${JSON.stringify(intentRequest)}`);
        const slots = intentRequest.currentIntent.slots;
        const validationResult = validateOneTimePayment(clientPaymentDate);
        if (!validationResult.isValid) {
            slots[`${validationResult.violatedSlot}`] = null;
            callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, 
                                slots, validationResult.violatedSlot, validationResult.message, 
                                null));
            return;
        }
    
        if (clientPaymentDate) {
            g_paymentDate = formatDate(clientPaymentDate);
            callback(close(outputSessionAttributes, 
                            'Fulfilled', { 
                                contentType: 'PlainText', 
                                content: `Mr. John, you agree to pay the overdue amount on ${g_paymentDate} as one time payment. I am sending you summary of our conversation through email. Thank you for your time.`
                            }));
        }
    
        callback(delegate(outputSessionAttributes, slots));
        return;
    }
}

// --------------- Intents -----------------------

/**
 * Called when the user specifies an intent for this skill.
 */
function dispatch(intentRequest, callback) {
    console.log(`dispatch userId=${intentRequest.userId}, intent=${intentRequest.currentIntent.name}`);

    const name = intentRequest.currentIntent.name;

    // Dispatch to your skill's intent handlers
    if (name === 'GetUserDetails') {
        return handleCollections(intentRequest, callback);
    } else if (name === 'InstallmentPayment') {
        return handleInstallments(intentRequest, callback);
    } else if (name === 'OneTimePayment') {
        return handleOneTimePayment(intentRequest, callback);
    }
    throw new Error(`Intent with name ${name} not supported`);
}

function loggingCallback(response, originalCallback) {
    // console.log(JSON.stringify(response, null, 2));
    originalCallback(null, response);
}

exports.handler = (event, context, callback) => {
    try {
        console.log(`event.bot.name=${JSON.stringify(context)}`);

        if (event.bot.name !== 'PromiseToPay') {
             callback('Invalid Bot Name');
        }
        
       dispatch(event, (response) => loggingCallback(response, callback));  
    } catch (err) {
        callback(err);
    }
};