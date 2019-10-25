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
    vocabularyGame: "vocabulary-game",
    sayAgain: "say-again",
    endGame: "end-game",
    bookFlight: "book-flight",
    define: "define",
    addWordToList: "add-word-to-list",
    listLists: "list-lists",
    sqlSelect: "sql-select",
};

var exampleIntents = ["Let's play pronunciation game", "Vocabulary game", "Say the last word again", "Game over", "Define word", "Add it to the list new words", "Show lists", "Select word and definition from new words"];

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
    _.lists = {};

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
                speechToText(msg.micPrompt, 1, function (results) {
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
            speechToText(_.lastMsg.micPrompt, 1, function (results) {
                _.$apply(function () {
                    var text = results[0];
                    var currIntent = getIntent(text);
                    _.addMsg({speaker:HUMAN, action: botWaitsForAnswer(currIntent) ? ANSWERING : ASKING, intent: currIntent, text: text });
                });
            });
        }
    }
});

function getIntent(text) {
    text = text.toLowerCase();

    if (text=="hi" || text=="hey" || text=="hello")
        return INTENTS.greeting;
    else if (text.match(/what time/gi))
        return INTENTS.whatTimeIsIt;
    else if (text.match(/define [a-z]+/gi))
        return INTENTS.define;
    else if (text.match(/add (last word|it)* *to the list [a-z]+/i))
        return INTENTS.addWordToList;
    else if(text.match(/(show|list) (the )*lists/i))
        return INTENTS.listLists;
    else if(text.match(/select( [a-z]+)+ from( [a-z]+)+/i))
        return INTENTS.sqlSelect;
    else if (text.match(/(pronoun|pronunci).+game/gi))
        return INTENTS.pronounceGame;
    else if (text.match(/vocabulary.+game/gi))
        return INTENTS.vocabularyGame;
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

    var flight = _.findContext(INTENTS.bookFlight);

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
                    _.game = last;
                    _.game.iteration = 1;
                    _.game.lastWord = getRandomWord();
                    _.game.tryAgain = false;
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, word:_.game.lastWord, micPrompt:_.game.lastWord, prompt:"Ok. Here is a word. Say it!"};
                }
            }
            else {
                if(last.action==ASKING) // bot is waiting answer
                    msg = null;
                else if(_.game && last!=_.game){
                    if(_.game.lastResultSuccess){
                        _.game.lastWord = getRandomWord();
                        _.game.tryAgain = false;
                    }else{
                        _.game.tryAgain = !_.game.tryAgain;
                        if(!_.game.tryAgain) _.game.lastWord = getRandomWord();
                    }
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, word: _.game.lastWord, micPrompt:_.game.lastWord, prompt:_.game.tryAgain?"Try again!":"Here is another word."};
                    _.game.iteration++;
                }
                else
                    msg = null;
            }
            break;
        
        case INTENTS.vocabularyGame:
            if(last.speaker==HUMAN){
                if(prev.intent==INTENTS.vocabularyGame){ // ongoing game
                    _.game.lastResultSuccess = wordsSame(last.text, _.game.lastWord);
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, 
                        text: !_.game.lastResultSuccess ? `${getFailAnswer()} It is ${_.game.lastWord}.` : `${getBravoAnswer()} ${_.game.lastWord} is correct.`, 
                        mood:_.game.lastResultSuccess ? MOODS.excited : MOODS.sad,
                        list:_.game.vocabularys};
                }
                else { // new game
                    _.game = last;
                    _.game.iteration = 1;
                    var entry = getRandomWordWithDefinition();
                    _.game.lastWord = entry.word;
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, prompt:`Ok. What is the word for this definition? ${entry.definition}`, micPrompt:entry.definition};
                }
            }
            else {
                if(last.action==ASKING) // bot is waiting answer
                    msg = null;
                else if(_.game && last!=_.game){
                    var entry = getRandomWordWithDefinition();
                    _.game.lastWord = entry.word;
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, prompt:(_.game.iteration<3?'Here is another one: ':'')+`${entry.definition}`, micPrompt:entry.definition};
                    _.game.iteration++;
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

        case INTENTS.define:
            if(last.speaker==HUMAN){
                last.word = last.text.match(/define (.+)\b/i)[1];
                var def = defineWord(last.word);
                last.text = 'define:';
                msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:last.word + ". " + (def || "I don't know that word")};
            }
            break;
        
        case INTENTS.addWordToList:
            if(last.speaker==HUMAN){
                var defineMsg = _.findContext(INTENTS.define);
                if(!defineMsg || !defineMsg.word)
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"No word in context"};
                else {
                    var listName = last.text.match(/add (last word|it)* *to the list ([a-z]+)/i)[2];
                    if(!_.lists[listName]) _.lists[listName] = [];
                    _.lists[listName].push({word:defineMsg.word, definition:defineWord(defineMsg.word)});
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:`added ${defineMsg.word} to the list ${listName}`};
                }
            }
            break;

        case INTENTS.listLists:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:"Here are your lists:", list:Enumerable.From(_.lists).Select(x=>x.Key).ToArray()} : null;
            break;

        case INTENTS.sqlSelect:
            if(last.speaker==HUMAN){
                var res = last.text.match(/select(?<fields>(?: [a-z]+)+) from(?<list>(?: [a-z]+)+)/i);
                var fields = res.groups.fields.trim().split(' ');
                var listName = res.groups.list.trim();
                if(fields && listName){
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, 
                        text:`${listName} contains`, resultSet:{
                            columnNames:fields, 
                            data:Enumerable.From(_.lists[listName]).Select('x=>['+Enumerable.From(fields).Select(x=>'x.'+x).ToArray().join()+']').ToArray()}};
                }
                else
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"SQL parse error"};
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
