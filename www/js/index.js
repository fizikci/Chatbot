var _ = null;
var timePassed = 0;
var BOT = 1;
var HUMAN = 2;
var ANSWERING = 1;
var ASKING = 2;

var INTENTS = {
    unresolved: "unresolved",
    welcome: "welcome",
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

var LEVELS = {beginner:0, intermediate:1, advanced:2};

var exampleIntents = ["Let's play pronunciation game", "Play vocabulary game", 'You can say "Game over" anytime to finish a game', "Define anything", "Show stats"];

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
    loadLocalData();

    _.addMsg = function(msg){
        if(!msg) return;

        msg.ser = JSON.stringify(msg);

        msg.time = timePassed;
        _.msgs.push(msg);
        _.lastMsg = msg;
        setTimeout(scrollToBottom, 200);

        if(msg.text && msg.speaker==BOT)
            speak(msg.text, msg.mood || MOODS.normal, msg.lang);
        
        if(msg.prompt && msg.speaker==BOT)
            speak(msg.prompt, msg.mood || MOODS.normal, msg.lang, function(){
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
    else if(text.match(/show words in( the)*( list)* ([a-z]+)/i))
        return INTENTS.showList;
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

function botWaitsForAnswer(currIntent){
    if(currIntent)
        return _.lastMsg && _.lastMsg.intent==currIntent && _.lastMsg.speaker==BOT && _.lastMsg.prompt;
    else
        return _.lastMsg && _.lastMsg.speaker==BOT && _.lastMsg.prompt;
}
