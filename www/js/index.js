var _ = null;
var timePassed = 0;
var BOT = 1;
var HUMAN = 2;
var ANSWERING = 1;
var ASKING = 2;

var INTENTS = {
    unresolved:     /xd76t47hgf784yzkfh847h4o7fzi4/,
    welcome:        /djh4yhse87y4hfsy74fuisay47fhia47/,
    greeting:       /^(hi|hey|hello)$/,
    help:           /^help$/,
    whatTimeIsIt:   /what time/,
    askingName:     /what.+your.+name/,
    pronounceGame:  /(pronoun|pronunci).+game/,
    vocabularyGame: /vocabulary.+game/,
    sayAgain:       /(say|word).+again/,
    endGame:        /((end|quit|finish|stop).+game)|game over/,
    bookFlight:     /(want|need|book).+(fly|flight)/,
    define:         /define [a-z]+/,
    addWordToList:  /add (last word|it)* *to the list [a-z]+/,
    listLists:      /(show|list) (the )*lists/,
    showList:       /show words in( the)*( list)* ([a-z]+)/,
    showStats:      /(show|display) stats/,
    dev:            /^dev:(.+)$/
};

var LEVELS = {
    beginner:0, 
    intermediate:1, 
    advanced:2,
    getName(val){
        return Enumerable.From(LEVELS).Where(o=>o.Value==val).Select(o=>capitalize(o.Key)).First();
    }
};

var exampleIntents = ["Pronunciation game", "Vocabulary game", 'Game over (anytime to finish a game)', "Define anything", "Show stats"];

setInterval(function(){
    timePassed++;

    if(micListening || speaking)
        return;
        
    getNextBotMsg().then(function(msg){
        if(msg)
            _.$apply(function(){ _.addMsg(msg); });
    });
}, 1000);

var app = angular.module('pronounceApp', []);
app.controller('MainController', function ($scope) {

    checkSpeech();

    _ = $scope;
    _.micAvailable = micAvailable;
    _.msgs = [];
    loadLocalData();

    _.addMsg = function(msg){
        if(!msg) return;

        //msg.ser = JSON.stringify(msg);

        msg.time = timePassed;
        _.msgs.push(msg);
        _.lastMsg = msg;
        setTimeout(scrollToBottom, 200);

        if(msg.text && msg.speaker==BOT)
            speak(msg, null);
        
        if(msg.prompt && msg.speaker==BOT)
            speak(msg, function(){
                speechToText(msg.micPrompt, 1, msg.micLang, function (results) {
                    _.$apply(function(){
                        var currIntent = getIntent(results[0]);
                        _.addMsg({speaker:HUMAN, action:botWaitsForAnswer(currIntent) ? ANSWERING : ASKING, intent:currIntent, text:results[0]});
                    });
                });
            });
    }

    _.addMsg({speaker:BOT, action:ANSWERING, intent:INTENTS.welcome, text:"Welcome to English Learner's Chatbot!"});

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
            speechToText(_.lastMsg.micPrompt, 1, _.lastMsg.micLang, function (results) {
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

    for(let key in INTENTS)
        if(text.match(INTENTS[key]))
            return INTENTS[key];

    if(botWaitsForAnswer())
        return _.lastMsg.intent;
    else
        return INTENTS.unresolved;
}

function botWaitsForAnswer(currIntent){
    if(currIntent)
        return _.lastMsg && _.lastMsg.intent==currIntent && _.lastMsg.speaker==BOT && _.lastMsg.prompt;
    else
        return _.lastMsg && _.lastMsg.speaker==BOT && _.lastMsg.prompt;
}
