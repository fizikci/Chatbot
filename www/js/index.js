var _ = null;
var timePassed = 0;
var BOT = 1;
var HUMAN = 2;
var ANSWERING = 1;
var ASKING = 2;

var INTENTS = {
    unresolved: "unresolved",
    greeting: "greeting",
    help: 'help',
    whatTimeIsIt: "what-time-is-it",
    askingName: "asking-name",
    pronounceGame: "pronounce-game",
    synonymGame: "synonym-game",
    sayAgain: "say-again",
    endGame: "end-game",
    bookFlight: "book-flight"
};

var exampleIntents = ["Let's play pronunciation game", "Synonym game", "Say the last word again", "Game over"];

setInterval(function(){
    if(micListening || speaking)
        return;
        
    getNextBotMsg().then(function(msg){
        if(msg)
            _.$apply(function(){ _.addMsg(msg); });
    });

    timePassed++;
}, 1000);

var app = angular.module('pronounceApp', []);
app.controller('MainController', function ($scope) {

    checkSpeech();

    _ = $scope;
    _.micAvailable = micAvailable;
    _.msgs = [];

    _.addMsg = function(msg){
        if(!msg) return;

        msg.time = timePassed;
        _.msgs.push(msg);
        _.lastMsg = msg;
        setTimeout(scrollToBottom, 200);

        if(msg.text && msg.speaker==BOT && _.msgs.length>1)
            speak(msg.text, msg.mood || MOODS.normal);
        
        if(msg.prompt && msg.speaker==BOT)
            speak(msg.prompt, msg.mood || MOODS.normal, function(){
                speechToText('', 1, function (results) {
                    _.$apply(function(){
                        var currIntent = getIntent(results[0]);
                        _.addMsg({speaker:HUMAN, action:botWaitsForAnswer(currIntent) ? ANSWERING : ASKING, intent:currIntent, text:results[0]});
                    });
                });
            });
    }

    _.addMsg({speaker:BOT, action:ANSWERING, intent:INTENTS.help, text:"Welcome to English Learner's Chatbot! Here are the things you can say:", list:exampleIntents});

    _.findContext = function(intent){
        return Enumerable.From(_.msgs).LastOrDefault(null,"$.intent=='"+intent+"' && $.speaker=="+HUMAN+" && $.action=="+ASKING);
    }

    _.getVoice = function () {
        if (!micAvailable || _.input) {
            var text = _.input || '???';
            var currIntent = getIntent(text);
            _.addMsg({speaker:HUMAN, action:botWaitsForAnswer(currIntent) ? ANSWERING : ASKING, intent: currIntent, text: text });
            _.input = '';
        }
        else if(micAvailable && !micListening){
            speechToText('', 1, function (results) {
                _.$apply(function () {
                    var text = results[0];
                    var currIntent = getIntent(text);
                    _.addMsg({speaker:HUMAN, action: botWaitsForAnswer(currIntent) ? ANSWERING : ASKING, intent: currIntent, text: text });
                });
            });
        }
    }
});

app.directive('ngEnter', function () {
    return function (_, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if (event.which === 13) {
                _.$apply(function () {
                    _.$eval(attrs.ngEnter);
                });

                event.preventDefault();
            }
        });
    };
});  


function getIntent(text) {
    text = text.toLowerCase();

    if (text=="hi" || text=="hey" || text=="hello")
        return INTENTS.greeting;
    else if (text.match(/what time/gi))
        return INTENTS.whatTimeIsIt;
    else if (text.match(/(pronoun|pronunci).+game/gi))
        return INTENTS.pronounceGame;
    else if (text.match(/synonym.+game/gi))
        return INTENTS.synonymGame;
    else if (text.match(/(want|need|book).+(fly|flight)/gi))
        return INTENTS.bookFlight;
    else if (text.match(/what.+your.+name/gi))
        return INTENTS.askingName;
    else if (text.match(/(say|word).+again/gi))
        return INTENTS.sayAgain;
    else if (text.match(/((end|quit|finish|stop).+game)|game over/gi))
        return INTENTS.endGame;
    else if (text=="help")
        return INTENTS.help;
    else if(botWaitsForAnswer())
        return _.lastMsg.intent;
    else
        return INTENTS.unresolved;
}

async function getNextBotMsg() {

    var last = _.lastMsg;
    var prev = _.msgs[_.msgs.indexOf(last)-1];

    if(last==null) return null;

    var msg = null;

    switch (last.intent) {

        case INTENTS.greeting:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:getGreetingAnswer()} : null;
            break;

        case INTENTS.unresolved:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:getUnresolvedAnswer()} : null;
            break;
                
        case INTENTS.whatTimeIsIt:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:"It is " + new Date().toTimeString().substr(0,5)} : null;
            break;

        case INTENTS.pronounceGame:
            if(last.speaker==HUMAN){
                if(prev.intent==INTENTS.pronounceGame){ // ongoing game
                    _.game.lastResultSuccess = wordsSame(last.text,prev.word);
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text: !_.game.lastResultSuccess ? "You should have said "+prev.word+". You said "+last.text : (prev.word+". "+getBravoAnswer()), mood:_.game.lastResultSuccess?MOODS.excited:MOODS.sad};
                }
                else { // new game
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, word:words[Math.ceil(Math.random() * 10000)] , prompt:"Ok. Here is a word. Say it!"};
                    _.game = last;
                    _.game.lastWord = msg.word;
                    _.game.tryAgain = false;
                }
            }
            else {
                if(last.action==ASKING) // bot is waiting answer
                    msg = null;
                else if(_.game && last!=_.game){
                    if(_.game.lastResultSuccess){
                        _.game.lastWord = words[Math.ceil(Math.random() * 10000)];
                        _.game.tryAgain = false;
                    }else{
                        _.game.tryAgain = !_.game.tryAgain;
                        if(!_.game.tryAgain) _.game.lastWord = words[Math.ceil(Math.random() * 10000)];
                    }
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, word: _.game.lastWord, prompt:_.game.tryAgain?"Try again!":"Here is another word."};
                }
                else
                    msg = null;
            }
            break;
        
        case INTENTS.synonymGame:
            if(last.speaker==HUMAN){
                if(prev.intent==INTENTS.synonymGame){ // ongoing game
                    _.game.lastResultSuccess = _.game.synonyms.indexOf(last.text)>-1;
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, 
                        text: (!_.game.lastResultSuccess ? "It is not one of the synonyms of "+_.game.lastWord+"." : (getBravoAnswer()+" You have found one synonym.")), 
                        mood:_.game.lastResultSuccess ? MOODS.excited : MOODS.sad,
                        list:_.game.synonyms};
                }
                else { // new game
                    _.game = last;
                    _.game.lastWord = words[Math.ceil(Math.random() * 2000)];
                    _.game.synonyms = await synonymSearch(_.game.lastWord);
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, prompt:"Ok. Say one synonym for "+_.game.lastWord};
                }
            }
            else {
                if(last.action==ASKING) // bot is waiting answer
                    msg = null;
                else if(_.game && last!=_.game){
                    _.game.lastWord = words[Math.ceil(Math.random() * 2000)];
                    _.game.synonyms = await synonymSearch(_.game.lastWord);
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, prompt:"Here is another word: "+_.game.lastWord};
                }
                else
                    msg = null;
            }
            break;
                                
        case INTENTS.help:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:INTENTS.help, text:"Here are the things you can say:", list:getExampleIntents()} : null;
            break;
        
        case INTENTS.sayAgain:
            if(last.speaker == HUMAN){
                for(let i=_.msgs.length-1; i>-1; i--)
                    if(_.msgs[i].speaker==BOT){
                        msg = {speaker:BOT, action:_.msgs[i].action, intent:_.msgs[i].intent, text:_.msgs[i].text, word:_.msgs[i].word, prompt:_.msgs[i].prompt, list:_.msgs[i].list};
                        break;
                    }
                if(!msg)
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"There is nothing to say"};
            }
            else msg = null;
            break;
        
        case INTENTS.endGame:
            if(last.speaker == BOT)
                msg = null;
            else if(_.game){
                _.game = null;
                msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"Ok. Game over!"};
            } 
            else 
                msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"There is no ongoing game."};
            break;
                        
        case INTENTS.askingName:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:"My name is Chatbot"} : null;
            break;

        case INTENTS.bookFlight:
            if(last.speaker == BOT)
                msg = null;
            else {
                if(!flight.parsed)
                    parseFlightRequest(flight);
                
                if(prev.asking) {
                    flight[prev.asking] = last.text;
                    if(prev.asking=='from')
                        citySearch(flight.from).then(res=>{ flight.from = res.meta.count>0?res.data[0].iataCode:null; flight.fromFetched = flight.from!=null; }).catch(ex=>{flight.from=null;});
                    if(prev.asking=='to')
                        citySearch(flight.to).then(res=>{ flight.to = res.meta.count>0?res.data[0].iataCode:null; flight.toFetched = flight.to!=null; }).catch(ex=>{flight.to=null;});
                    if(prev.asking=='when')
                        flight.when = resolveDate(flight.when);
                }

                if(!flight.from)
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"from", prompt:"Where are you flying from?"};
                else if(!flight.to)
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"to", prompt:"Where are you flying to?"};
                else if(!flight.when)
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"when", prompt:"When do yo want to fly?"};
                else if(!flight.confirm)
                    if(flight.fromFetched && flight.toFetched)
                        msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"confirm", prompt:`You want to fly from ${flight.from} to ${flight.to} ${flight.when}, is that right?`};
                    else
                        msg = null;
                else if(isYes(flight.confirm)){
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:`Great! Please wait while we are fetching flights from Amadeus...`, asyncList:'waiting', mood:MOODS.excited};
                    flightSearch(flight).then(res=>{
                        _.$apply(function(){
                            msg.asyncList = getFlightList(res);
                            setTimeout(scrollToBottom, 100);
                        });
                    });
                }
                else {
                    flight.over = true;
                    msg = null;
                }
            }
            break;
    }

    if(!msg && _.game && last.intent.indexOf('game')==-1 && last.time<timePassed-2){
        _.game = null;
    }

    return msg;
}

function botWaitsForAnswer(currIntent){
    if(currIntent)
        return _.lastMsg && _.lastMsg.intent==currIntent && _.lastMsg.speaker==BOT && _.lastMsg.prompt;
    else
        return _.lastMsg && _.lastMsg.speaker==BOT && _.lastMsg.prompt;
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