document.addEventListener('deviceready', onDeviceReady, false);
document.addEventListener("pause", onPause, false);

var lang = 'en-US';
var micAvailable = true;
var micListening = false;
var speaking = false;

function onDeviceReady() {
    angular.bootstrap(document, ['pronounceApp']);
}

function onPause(){
    saveLocalData();
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

function speechToText(prompt, matches, language, success) {
    micListening = true;
    let options = {
        language: language || lang,
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
    sad: {rate:1, volume:.5},
}
var speakLangs = {
     "en-US": "US English Female",
     "de-DE": "Deutsch Female",
     "fr-FR": "French Female",
     "it-IT": "Italian Female",
     "ru-RU": "Russian Female",
     "es-ES": "Spanish Female",
     "tr-TR": "Turkish Female"
    };
function speak(msg, success){
    console.log('speaking...', msg);
    msg.mood = msg.mood || MOODS.normal;
    responsiveVoice.speak(
        msg.prompt || msg.text, 
        speakLangs[msg.lang || lang], 
        {
            rate: msg.mood.rate, 
            volume: msg.mood.volume, 
            onstart: function(){speaking=true;},
            onend: function(){
                speaking=false; 
                if(msg.readList){
                    speak({text:msg.list.join(', '), mood:msg.mood, lang:msg.listLang}, success);
                } else if(success) 
                    success();
            }
        });
}

function getUnresolvedAnswer(){
    var answers = ["Sorry, I couldn't understand what you said.","Come again?","I am afraid I don't know how to reply this.","This is not covered by my limited knowledge","Can you please rephrase this?"];
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
    if(!w1.isLatin()) w1 = w1.latinize();
    if(!w2.isLatin()) w2 = w2.latinize();

    return w1.toLowerCase() == w2.toLowerCase() ||
    (w1.toLowerCase()+'s') == w2.toLowerCase() ||
    w1.toLowerCase() == (w2.toLowerCase()+'s');
}
function wordsSameAny(w, arr){
    return arr.some(x=>wordsSame(w,x));
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

function getRandomWord(forPronounce){
    let theWords = forPronounce ? words.filter(x=>_.db.lists["good pronounce"].indexOf(x)==-1) : words;
    let index = Math.ceil(Math.random() * theWords.length/3 + _.db.level * theWords.length/3);
    return theWords[index];
}

function getRandomWordWithDefinition(){
    var w = getRandomWord();
    var def = defineWord(w);

    if(!def) return getRandomWordWithDefinition(); else return {word:w, definition:def};
}

function loadLocalData(){
    _.db = JSON.parse(
        localStorage.getItem('data') ||  
        JSON.stringify({
            lists:{
                "bad pronounce":[], 
                "good pronounce":[]
            }, 
            level: -1,
            nativeLang: null
        }));
}
function saveLocalData(){
    localStorage.setItem('data', JSON.stringify(_.db));
}

var langs = {
    'turkish':'tr-TR', 'spanish':"es-ES", 'german':"de-DE", "french":"fr-FR", "italian":"it-IT", "russian":"ru-RU", "english":"en-US",
    getName(val){
        return Enumerable.From(langs).Where(o=>o.Value==val).Select(o=>capitalize(o.Key)).First();
    }
};

function getLanguage(lang){
    let l = langs[lang.trim().toLowerCase()];
    return l;
}
function getLevel(level){
    let l = LEVELS[level.trim().toLowerCase()];
    return l==null ? -1 : l;
}

function addWordToBadPronounceList(w){
    let bad = _.db.lists["bad pronounce"];
    let good = _.db.lists["good pronounce"];
    if(bad.indexOf(w)==-1) bad.push(w);
    if(good.indexOf(w)>-1) good.splice(good.indexOf(w), 1);
    saveLocalData();
}
function addWordToGoodPronounceList(w){
    let bad = _.db.lists["bad pronounce"];
    let good = _.db.lists["good pronounce"];
    if(good.indexOf(w)==-1) good.push(w);
    if(bad.indexOf(w)>-1) bad.splice(bad.indexOf(w), 1);
    saveLocalData();
}

function translate(word){
    let l = _.db.nativeLang.split('-')[0];
    var url = `https://dictionary.yandex.net/api/v1/dicservice.json/lookup?key=dict.1.1.20170503T043643Z.acbc117b19dabddd.305996dbc25bb00b5012ac31557e4d3590d7ddc5&lang=en-${l}&text=${word}`;
    return fetch(url).then(res=>res.json()).then( d=>{
        if(d.def){
            var res = [[d.def[0].text], [d.def[0].tr[0].text]];
            if(d.def[0].tr[0].mean)
                d.def[0].tr[0].mean.forEach(x=>res[0].push(x.text));
            if(d.def[0].tr[0].syn)
                d.def[0].tr[0].syn.forEach(x=>res[1].push(x.text));
            return res;
        }
        return [[''],['']];
    });
}

function define(word){
    return fetch('https://googledictionaryapi.eu-gb.mybluemix.net/?define='+word+'&lang=en')
    .then(r=>r.json())
    .then(d=>{
        var res = [];
        if(d && d[0] && d[0].meaning)
            for(var key in d[0].meaning)
                res.push(`(${key}) ${d[0].meaning[key][0].definition}`);
        else
            res.push('Not found in the dictionary!');
        return res;
    })
    .catch(res=>{
        return ['Not found in the dictionary!'];
    });
}

function scrollToBottom(){
    var objDiv = document.getElementById("cardContainer");
    objDiv.scrollTop = objDiv.scrollHeight;
}

function capitalize(str){
    return str[0].toUpperCase()+str.substr(1);
}

var Latinise={};Latinise.latin_map={"Á":"A","Ă":"A","Ắ":"A","Ặ":"A","Ằ":"A","Ẳ":"A","Ẵ":"A","Ǎ":"A","Â":"A","Ấ":"A","Ậ":"A","Ầ":"A","Ẩ":"A","Ẫ":"A","Ä":"A","Ǟ":"A","Ȧ":"A","Ǡ":"A","Ạ":"A","Ȁ":"A","À":"A","Ả":"A","Ȃ":"A","Ā":"A","Ą":"A","Å":"A","Ǻ":"A","Ḁ":"A","Ⱥ":"A","Ã":"A","Ꜳ":"AA","Æ":"AE","Ǽ":"AE","Ǣ":"AE","Ꜵ":"AO","Ꜷ":"AU","Ꜹ":"AV","Ꜻ":"AV","Ꜽ":"AY","Ḃ":"B","Ḅ":"B","Ɓ":"B","Ḇ":"B","Ƀ":"B","Ƃ":"B","Ć":"C","Č":"C","Ç":"C","Ḉ":"C","Ĉ":"C","Ċ":"C","Ƈ":"C","Ȼ":"C","Ď":"D","Ḑ":"D","Ḓ":"D","Ḋ":"D","Ḍ":"D","Ɗ":"D","Ḏ":"D","ǲ":"D","ǅ":"D","Đ":"D","Ƌ":"D","Ǳ":"DZ","Ǆ":"DZ","É":"E","Ĕ":"E","Ě":"E","Ȩ":"E","Ḝ":"E","Ê":"E","Ế":"E","Ệ":"E","Ề":"E","Ể":"E","Ễ":"E","Ḙ":"E","Ë":"E","Ė":"E","Ẹ":"E","Ȅ":"E","È":"E","Ẻ":"E","Ȇ":"E","Ē":"E","Ḗ":"E","Ḕ":"E","Ę":"E","Ɇ":"E","Ẽ":"E","Ḛ":"E","Ꝫ":"ET","Ḟ":"F","Ƒ":"F","Ǵ":"G","Ğ":"G","Ǧ":"G","Ģ":"G","Ĝ":"G","Ġ":"G","Ɠ":"G","Ḡ":"G","Ǥ":"G","Ḫ":"H","Ȟ":"H","Ḩ":"H","Ĥ":"H","Ⱨ":"H","Ḧ":"H","Ḣ":"H","Ḥ":"H","Ħ":"H","Í":"I","Ĭ":"I","Ǐ":"I","Î":"I","Ï":"I","Ḯ":"I","İ":"I","Ị":"I","Ȉ":"I","Ì":"I","Ỉ":"I","Ȋ":"I","Ī":"I","Į":"I","Ɨ":"I","Ĩ":"I","Ḭ":"I","Ꝺ":"D","Ꝼ":"F","Ᵹ":"G","Ꞃ":"R","Ꞅ":"S","Ꞇ":"T","Ꝭ":"IS","Ĵ":"J","Ɉ":"J","Ḱ":"K","Ǩ":"K","Ķ":"K","Ⱪ":"K","Ꝃ":"K","Ḳ":"K","Ƙ":"K","Ḵ":"K","Ꝁ":"K","Ꝅ":"K","Ĺ":"L","Ƚ":"L","Ľ":"L","Ļ":"L","Ḽ":"L","Ḷ":"L","Ḹ":"L","Ⱡ":"L","Ꝉ":"L","Ḻ":"L","Ŀ":"L","Ɫ":"L","ǈ":"L","Ł":"L","Ǉ":"LJ","Ḿ":"M","Ṁ":"M","Ṃ":"M","Ɱ":"M","Ń":"N","Ň":"N","Ņ":"N","Ṋ":"N","Ṅ":"N","Ṇ":"N","Ǹ":"N","Ɲ":"N","Ṉ":"N","Ƞ":"N","ǋ":"N","Ñ":"N","Ǌ":"NJ","Ó":"O","Ŏ":"O","Ǒ":"O","Ô":"O","Ố":"O","Ộ":"O","Ồ":"O","Ổ":"O","Ỗ":"O","Ö":"O","Ȫ":"O","Ȯ":"O","Ȱ":"O","Ọ":"O","Ő":"O","Ȍ":"O","Ò":"O","Ỏ":"O","Ơ":"O","Ớ":"O","Ợ":"O","Ờ":"O","Ở":"O","Ỡ":"O","Ȏ":"O","Ꝋ":"O","Ꝍ":"O","Ō":"O","Ṓ":"O","Ṑ":"O","Ɵ":"O","Ǫ":"O","Ǭ":"O","Ø":"O","Ǿ":"O","Õ":"O","Ṍ":"O","Ṏ":"O","Ȭ":"O","Ƣ":"OI","Ꝏ":"OO","Ɛ":"E","Ɔ":"O","Ȣ":"OU","Ṕ":"P","Ṗ":"P","Ꝓ":"P","Ƥ":"P","Ꝕ":"P","Ᵽ":"P","Ꝑ":"P","Ꝙ":"Q","Ꝗ":"Q","Ŕ":"R","Ř":"R","Ŗ":"R","Ṙ":"R","Ṛ":"R","Ṝ":"R","Ȑ":"R","Ȓ":"R","Ṟ":"R","Ɍ":"R","Ɽ":"R","Ꜿ":"C","Ǝ":"E","Ś":"S","Ṥ":"S","Š":"S","Ṧ":"S","Ş":"S","Ŝ":"S","Ș":"S","Ṡ":"S","Ṣ":"S","Ṩ":"S","Ť":"T","Ţ":"T","Ṱ":"T","Ț":"T","Ⱦ":"T","Ṫ":"T","Ṭ":"T","Ƭ":"T","Ṯ":"T","Ʈ":"T","Ŧ":"T","Ɐ":"A","Ꞁ":"L","Ɯ":"M","Ʌ":"V","Ꜩ":"TZ","Ú":"U","Ŭ":"U","Ǔ":"U","Û":"U","Ṷ":"U","Ü":"U","Ǘ":"U","Ǚ":"U","Ǜ":"U","Ǖ":"U","Ṳ":"U","Ụ":"U","Ű":"U","Ȕ":"U","Ù":"U","Ủ":"U","Ư":"U","Ứ":"U","Ự":"U","Ừ":"U","Ử":"U","Ữ":"U","Ȗ":"U","Ū":"U","Ṻ":"U","Ų":"U","Ů":"U","Ũ":"U","Ṹ":"U","Ṵ":"U","Ꝟ":"V","Ṿ":"V","Ʋ":"V","Ṽ":"V","Ꝡ":"VY","Ẃ":"W","Ŵ":"W","Ẅ":"W","Ẇ":"W","Ẉ":"W","Ẁ":"W","Ⱳ":"W","Ẍ":"X","Ẋ":"X","Ý":"Y","Ŷ":"Y","Ÿ":"Y","Ẏ":"Y","Ỵ":"Y","Ỳ":"Y","Ƴ":"Y","Ỷ":"Y","Ỿ":"Y","Ȳ":"Y","Ɏ":"Y","Ỹ":"Y","Ź":"Z","Ž":"Z","Ẑ":"Z","Ⱬ":"Z","Ż":"Z","Ẓ":"Z","Ȥ":"Z","Ẕ":"Z","Ƶ":"Z","Ĳ":"IJ","Œ":"OE","ᴀ":"A","ᴁ":"AE","ʙ":"B","ᴃ":"B","ᴄ":"C","ᴅ":"D","ᴇ":"E","ꜰ":"F","ɢ":"G","ʛ":"G","ʜ":"H","ɪ":"I","ʁ":"R","ᴊ":"J","ᴋ":"K","ʟ":"L","ᴌ":"L","ᴍ":"M","ɴ":"N","ᴏ":"O","ɶ":"OE","ᴐ":"O","ᴕ":"OU","ᴘ":"P","ʀ":"R","ᴎ":"N","ᴙ":"R","ꜱ":"S","ᴛ":"T","ⱻ":"E","ᴚ":"R","ᴜ":"U","ᴠ":"V","ᴡ":"W","ʏ":"Y","ᴢ":"Z","á":"a","ă":"a","ắ":"a","ặ":"a","ằ":"a","ẳ":"a","ẵ":"a","ǎ":"a","â":"a","ấ":"a","ậ":"a","ầ":"a","ẩ":"a","ẫ":"a","ä":"a","ǟ":"a","ȧ":"a","ǡ":"a","ạ":"a","ȁ":"a","à":"a","ả":"a","ȃ":"a","ā":"a","ą":"a","ᶏ":"a","ẚ":"a","å":"a","ǻ":"a","ḁ":"a","ⱥ":"a","ã":"a","ꜳ":"aa","æ":"ae","ǽ":"ae","ǣ":"ae","ꜵ":"ao","ꜷ":"au","ꜹ":"av","ꜻ":"av","ꜽ":"ay","ḃ":"b","ḅ":"b","ɓ":"b","ḇ":"b","ᵬ":"b","ᶀ":"b","ƀ":"b","ƃ":"b","ɵ":"o","ć":"c","č":"c","ç":"c","ḉ":"c","ĉ":"c","ɕ":"c","ċ":"c","ƈ":"c","ȼ":"c","ď":"d","ḑ":"d","ḓ":"d","ȡ":"d","ḋ":"d","ḍ":"d","ɗ":"d","ᶑ":"d","ḏ":"d","ᵭ":"d","ᶁ":"d","đ":"d","ɖ":"d","ƌ":"d","ı":"i","ȷ":"j","ɟ":"j","ʄ":"j","ǳ":"dz","ǆ":"dz","é":"e","ĕ":"e","ě":"e","ȩ":"e","ḝ":"e","ê":"e","ế":"e","ệ":"e","ề":"e","ể":"e","ễ":"e","ḙ":"e","ë":"e","ė":"e","ẹ":"e","ȅ":"e","è":"e","ẻ":"e","ȇ":"e","ē":"e","ḗ":"e","ḕ":"e","ⱸ":"e","ę":"e","ᶒ":"e","ɇ":"e","ẽ":"e","ḛ":"e","ꝫ":"et","ḟ":"f","ƒ":"f","ᵮ":"f","ᶂ":"f","ǵ":"g","ğ":"g","ǧ":"g","ģ":"g","ĝ":"g","ġ":"g","ɠ":"g","ḡ":"g","ᶃ":"g","ǥ":"g","ḫ":"h","ȟ":"h","ḩ":"h","ĥ":"h","ⱨ":"h","ḧ":"h","ḣ":"h","ḥ":"h","ɦ":"h","ẖ":"h","ħ":"h","ƕ":"hv","í":"i","ĭ":"i","ǐ":"i","î":"i","ï":"i","ḯ":"i","ị":"i","ȉ":"i","ì":"i","ỉ":"i","ȋ":"i","ī":"i","į":"i","ᶖ":"i","ɨ":"i","ĩ":"i","ḭ":"i","ꝺ":"d","ꝼ":"f","ᵹ":"g","ꞃ":"r","ꞅ":"s","ꞇ":"t","ꝭ":"is","ǰ":"j","ĵ":"j","ʝ":"j","ɉ":"j","ḱ":"k","ǩ":"k","ķ":"k","ⱪ":"k","ꝃ":"k","ḳ":"k","ƙ":"k","ḵ":"k","ᶄ":"k","ꝁ":"k","ꝅ":"k","ĺ":"l","ƚ":"l","ɬ":"l","ľ":"l","ļ":"l","ḽ":"l","ȴ":"l","ḷ":"l","ḹ":"l","ⱡ":"l","ꝉ":"l","ḻ":"l","ŀ":"l","ɫ":"l","ᶅ":"l","ɭ":"l","ł":"l","ǉ":"lj","ſ":"s","ẜ":"s","ẛ":"s","ẝ":"s","ḿ":"m","ṁ":"m","ṃ":"m","ɱ":"m","ᵯ":"m","ᶆ":"m","ń":"n","ň":"n","ņ":"n","ṋ":"n","ȵ":"n","ṅ":"n","ṇ":"n","ǹ":"n","ɲ":"n","ṉ":"n","ƞ":"n","ᵰ":"n","ᶇ":"n","ɳ":"n","ñ":"n","ǌ":"nj","ó":"o","ŏ":"o","ǒ":"o","ô":"o","ố":"o","ộ":"o","ồ":"o","ổ":"o","ỗ":"o","ö":"o","ȫ":"o","ȯ":"o","ȱ":"o","ọ":"o","ő":"o","ȍ":"o","ò":"o","ỏ":"o","ơ":"o","ớ":"o","ợ":"o","ờ":"o","ở":"o","ỡ":"o","ȏ":"o","ꝋ":"o","ꝍ":"o","ⱺ":"o","ō":"o","ṓ":"o","ṑ":"o","ǫ":"o","ǭ":"o","ø":"o","ǿ":"o","õ":"o","ṍ":"o","ṏ":"o","ȭ":"o","ƣ":"oi","ꝏ":"oo","ɛ":"e","ᶓ":"e","ɔ":"o","ᶗ":"o","ȣ":"ou","ṕ":"p","ṗ":"p","ꝓ":"p","ƥ":"p","ᵱ":"p","ᶈ":"p","ꝕ":"p","ᵽ":"p","ꝑ":"p","ꝙ":"q","ʠ":"q","ɋ":"q","ꝗ":"q","ŕ":"r","ř":"r","ŗ":"r","ṙ":"r","ṛ":"r","ṝ":"r","ȑ":"r","ɾ":"r","ᵳ":"r","ȓ":"r","ṟ":"r","ɼ":"r","ᵲ":"r","ᶉ":"r","ɍ":"r","ɽ":"r","ↄ":"c","ꜿ":"c","ɘ":"e","ɿ":"r","ś":"s","ṥ":"s","š":"s","ṧ":"s","ş":"s","ŝ":"s","ș":"s","ṡ":"s","ṣ":"s","ṩ":"s","ʂ":"s","ᵴ":"s","ᶊ":"s","ȿ":"s","ɡ":"g","ᴑ":"o","ᴓ":"o","ᴝ":"u","ť":"t","ţ":"t","ṱ":"t","ț":"t","ȶ":"t","ẗ":"t","ⱦ":"t","ṫ":"t","ṭ":"t","ƭ":"t","ṯ":"t","ᵵ":"t","ƫ":"t","ʈ":"t","ŧ":"t","ᵺ":"th","ɐ":"a","ᴂ":"ae","ǝ":"e","ᵷ":"g","ɥ":"h","ʮ":"h","ʯ":"h","ᴉ":"i","ʞ":"k","ꞁ":"l","ɯ":"m","ɰ":"m","ᴔ":"oe","ɹ":"r","ɻ":"r","ɺ":"r","ⱹ":"r","ʇ":"t","ʌ":"v","ʍ":"w","ʎ":"y","ꜩ":"tz","ú":"u","ŭ":"u","ǔ":"u","û":"u","ṷ":"u","ü":"u","ǘ":"u","ǚ":"u","ǜ":"u","ǖ":"u","ṳ":"u","ụ":"u","ű":"u","ȕ":"u","ù":"u","ủ":"u","ư":"u","ứ":"u","ự":"u","ừ":"u","ử":"u","ữ":"u","ȗ":"u","ū":"u","ṻ":"u","ų":"u","ᶙ":"u","ů":"u","ũ":"u","ṹ":"u","ṵ":"u","ᵫ":"ue","ꝸ":"um","ⱴ":"v","ꝟ":"v","ṿ":"v","ʋ":"v","ᶌ":"v","ⱱ":"v","ṽ":"v","ꝡ":"vy","ẃ":"w","ŵ":"w","ẅ":"w","ẇ":"w","ẉ":"w","ẁ":"w","ⱳ":"w","ẘ":"w","ẍ":"x","ẋ":"x","ᶍ":"x","ý":"y","ŷ":"y","ÿ":"y","ẏ":"y","ỵ":"y","ỳ":"y","ƴ":"y","ỷ":"y","ỿ":"y","ȳ":"y","ẙ":"y","ɏ":"y","ỹ":"y","ź":"z","ž":"z","ẑ":"z","ʑ":"z","ⱬ":"z","ż":"z","ẓ":"z","ȥ":"z","ẕ":"z","ᵶ":"z","ᶎ":"z","ʐ":"z","ƶ":"z","ɀ":"z","ﬀ":"ff","ﬃ":"ffi","ﬄ":"ffl","ﬁ":"fi","ﬂ":"fl","ĳ":"ij","œ":"oe","ﬆ":"st","ₐ":"a","ₑ":"e","ᵢ":"i","ⱼ":"j","ₒ":"o","ᵣ":"r","ᵤ":"u","ᵥ":"v","ₓ":"x"};
String.prototype.latinise=function(){return this.replace(/[^A-Za-z0-9\[\] ]/g,function(a){return Latinise.latin_map[a]||a})};
String.prototype.latinize=String.prototype.latinise;
String.prototype.isLatin=function(){return this==this.latinise()}

var Reflector = function(obj) {
    this.getProperties = function() {
      var properties = [];
      for (var prop in obj) {
        if (typeof obj[prop] != 'function') {
          properties.push(prop);
        }
      }
      return properties;
    };

    this.getValues = function() {
        var values = [];
        for (var prop in obj) {
          if (typeof obj[prop] != 'function') {
            values.push(obj[prop]);
          }
        }
        return values;
      };
    
      this.getEntries = function() {
        var values = [];
        for (var prop in obj) {
          if (typeof obj[prop] != 'function') {
            values.push([prop, obj[prop]]);
          }
        }
        return values;
      };
    
  }