document.addEventListener('deviceready', onDeviceReady, false);

var lang = 'en-US';
var micAvailable = true;
var micListening = false;
var speaking = false;

function onDeviceReady() {
    angular.bootstrap(document, ['pronounceApp']);
}

function checkSpeech() {
    if (device.platform == "browser")
        micAvailable = false;

    window.plugins.speechRecognition.isRecognitionAvailable(
        function () {
            window.plugins.speechRecognition.hasPermission(
                function (hasPermission) {
                    if (!hasPermission)
                        window.plugins.speechRecognition.requestPermission(
                            function (res) {
                                if (res != "OK")
                                    micAvailable = false;
                                else
                                    micAvailable = true;
                            }
                        );
                    else
                        micAvailable = true;
                }
            );
        },
        function(){micAvailable = false;}
    );

}

function speechToText(prompt, matches, success) {
    micListening = true;
    let options = {
        language: lang,
        matches: matches,
        prompt: prompt,      // Android only
        showPopup: true,  // Android only
        showPartial: false
    }
    window.plugins.speechRecognition.startListening(
        function(results){micListening=false; success(results);},
        function (err) {micListening=false; /*success(JSON.stringify(err));*/},
        options);
}

var MOODS = {
    normal: {rate:1, volume:.7},
    excited: {rate:1, volume:1},
    sad: {rate:.8, volume:.5},
}
function speak(text, mood, success){
    //if(!micAvailable) return;
    speaking = true;
    responsiveVoice.speak(text, "US English Female", {rate: mood.rate, volume:mood.volume, onend:function(){speaking=false; if(success) success();}});
    //TTS.speak({ text: text, locale: lang, rate: mood.rate }, function(){speaking=false; if(success) success();});
}

function getUnresolvedAnswer(){
    var answers = ["Sorry, I couldn't understand what you said.","Come again?","I am afraid I don't know this.","I have never heard this","This is not covered by my limited knowledge","Can you please rephrase this?"];
    return answers[Math.floor(Math.random()*answers.length)];
}

function getGreetingAnswer(){
    var answers = ["Hi!","Hey!","Hello"];
    return answers[Math.floor(Math.random()*answers.length)];
}

function getBravoAnswer(){
    var answers = ["Great!","Perfect!","Excellent!","Bravo!","You are good!"];
    return answers[Math.floor(Math.random()*answers.length)];
}

function getFailAnswer(){
    var answers = ["Wrong!","Sorry!","Not correct!","Nope!","No!"];
    return answers[Math.floor(Math.random()*answers.length)];
}

function wordsSame(w1, w2){
    return w1.toLowerCase() == w2.toLowerCase() ||
    (w1.toLowerCase()+'s') == w2.toLowerCase() ||
    w1.toLowerCase() == (w2.toLowerCase()+'s');
}

function isYes(str){
    return str.match(/yes|ok|yep|right|true/i);
}

function resolveDate(str){
    var now = new Date();
    var tomorrow = new Date(); tomorrow.setDate(now.getDate()+1);
    var nextWeek = new Date(); nextWeek.setDate(now.getDate()+7);
    var nextMonth = new Date(); nextMonth.setDate(now.getDate()+30)
    if(str=='today') return now.toISOString().substr(0,10);
    if(str=='tomorrow') return tomorrow.toISOString().substr(0,10);
    if(str=='next week') return nextWeek.toISOString().substr(0,10);
    if(str=='next month') return nextMonth.toISOString().substr(0,10);
    return nextWeek.toISOString().substr(0,10);
}

var flightApiKey = "hE2AG16bFzeUaCXzPSfSzTt8EUXhlPoG";
var flightApiSecret = "OIsF2Am3tdd5XAbb";
var flightApiToken = "";

async function flightApiGetToken(){
    return (await (await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
                        method: 'post',
                        headers: {"Content-type": "application/x-www-form-urlencoded"},
                        body: `grant_type=client_credentials&client_id=${flightApiKey}&client_secret=${flightApiSecret}`
                    })
            ).json()).access_token;
}

async function flightSearch(flight){
    if(!flightApiToken)
        flightApiToken = await flightApiGetToken();

    var url = `https://test.api.amadeus.com/v1/shopping/flight-offers?origin=${flight.from}&destination=${flight.to}&departureDate=${flight.when}&max=10`;
    return fetch(url, {
                        headers: {"Authorization": "Bearer "+flightApiToken}
                    })
                    .then(res=>res.json());
}

function getFlightList(res){
    return Enumerable.From(res.data).Select(d=>
        d.offerItems[0].services[0].segments[0].flightSegment.carrierCode + ' ' +
        d.offerItems[0].services[0].segments[0].pricingDetailPerAdult.travelClass + ' class from ' +
        d.offerItems[0].price.total +' '+ res.meta.currency
                ).ToArray();
}

async function citySearch(keyword){
    console.log('city search for '+keyword);
    if(!flightApiToken)
        flightApiToken = await flightApiGetToken();

    var url = `https://test.api.amadeus.com/v1/reference-data/locations?subType=CITY&keyword=${keyword}&page[limit]=1`;
    return fetch(url, {
                        headers: {"Authorization": "Bearer "+flightApiToken}
                    })
                    .then(res=>res.json());
}

function parseFlightRequest(flight){
    var str = flight.text;
    var res = str.match(/today|tomorrow|next week|next month/i);
    if(res){
        flight.when = resolveDate(res[0]);
        str = str.replace(res[0],'');
    }

    res = str.match(/from (.+) to (.+)/i);
    if(res && res.length>0){
        flight.from = res[1];
        citySearch(flight.from).then(r=>{ flight.from = r.meta.count>0?r.data[0].iataCode:null; flight.fromFetched = flight.from!=null; }).catch(ex=>{flight.from=null;});
        flight.to = res[2];
        citySearch(flight.to).then(r=>{ flight.to = r.meta.count>0?r.data[0].iataCode:null; flight.toFetched = flight.to!=null; }).catch(ex=>{flight.to=null;});
    } else {
        res = str.match(/to (.+)/i);
        if(res && res.length>0){
            flight.to = res[1];
            citySearch(flight.to).then(r=>{ flight.to = r.meta.count>0?r.data[0].iataCode:null; flight.toFetched = flight.to!=null; }).catch(ex=>{flight.to=null;});
        } else {
            res = str.match(/from (.+)/i);
            if(res && res.length>0){
                flight.from = res[1];
                citySearch(flight.from).then(r=>{ flight.from = r.meta.count>0?r.data[0].iataCode:null; flight.fromFetched = flight.from!=null; }).catch(ex=>{flight.from=null;});
            }        
        }
    }

    flight.parsed = true;
}

function getRandomWord(limit){
    return words[Math.ceil(Math.random() * (limit || words.length))];
}

function defineWord(word){
    var v = verbs[word]; if(v) v = v[0];
    var a = adjectives[word]; if(a) a = a[0];
    var n = nouns[word]; if(n) n = n[0];

    if(v && v.indexOf(word)>-1 && n)
        return n;

    if(a && a.indexOf(word)>-1 && n)
        return n;
    
    return v || a || n;
}

function getRandomWordWithDefinition(){
    var w = getRandomWord();
    var def = defineWord(w);

    if(!def) return getRandomWordWithDefinition(); else return {word:w, definition:def};
}

function scrollToBottom(){
    var objDiv = document.getElementById("cardContainer");
    objDiv.scrollTop = objDiv.scrollHeight;
}

