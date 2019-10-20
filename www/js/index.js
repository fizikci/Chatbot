var scope = null;
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
    sayAgain: "say-again",
    endGame: "end-game"
};

setInterval(function(){
    if(micListening)
        return;

    scope.$apply(function(){        
        scope.addMsg(getNextBotMsg());
    });
    timePassed++;
}, 1000);

angular.module('pronounceApp', [])
    .controller('MainController', function ($scope) {

        checkSpeech();

        scope = $scope;
        scope.micAvailable = micAvailable;
        scope.msgs = [];

        scope.addMsg = function(msg){
            if(!msg) return;

            msg.time = timePassed;
            scope.msgs.push(msg);
            scope.lastMsg = msg;
            setTimeout(function(){
                var objDiv = document.getElementById("cardContainer");
                objDiv.scrollTop = objDiv.scrollHeight;
            }, 200);

            if(msg.text && msg.speaker==BOT)
                speak(msg.text, MOODS.normal);
            
            if(msg.prompt && msg.speaker==BOT)
                speak(msg.prompt, MOODS.normal, function(){
                    speechToText('', 1, function (results) {
                        scope.$apply(function(){
                            scope.addMsg({speaker:HUMAN, action:ANSWERING, intent:msg.intent, text:results[0]});
                        });
                    });
                });
        }

        scope.findMsg = function(intent){
            return Enumerable.From(scope.msgs).LastOrDefault(null,"$.intent=='"+intent+"' && $.speaker=="+HUMAN+" && $.action=="+ASKING);
        }

        scope.getVoice = function () {
            if (!micAvailable || $scope.input) {
                var text = $scope.input || '???';
                scope.addMsg({speaker:HUMAN, action:botWaitsForAnswer() ? ANSWERING : ASKING, intent: getIntent(text), text: text });
                scope.input = '';
            }
            else if(micAvailable && !micListening){
                speechToText('', 1, function (results) {
                    scope.$apply(function () {
                        var text = results[0];
                        scope.addMsg({speaker:HUMAN, action: botWaitsForAnswer() ? ANSWERING : ASKING, intent: getIntent(text), text: text });
                    });
                });
            }
        }
    });


function getIntent(text) {
    if (text.match(/hi|hey|hello/gi))
        return INTENTS.greeting;
    else if (text.match(/what time/gi))
        return INTENTS.whatTimeIsIt;
    else if (text.match(/pronoun|pronunci/gi))
        return INTENTS.pronounceGame;
    else if (text.match(/your.+name/gi))
        return INTENTS.askingName;
    else if (text.match(/(say|word).+again/gi))
        return INTENTS.sayAgain;
    else if (text.match(/((end|quit|finish).+game)|game over/gi))
        return INTENTS.endGame;
    else if (text.match(/help/gi))
        return INTENTS.help;
    else if(botWaitsForAnswer())
        return scope.lastMsg.intent;
    else
        return INTENTS.unresolved;
}

function getNextBotMsg() {
    
    if(scope.msgs.length==0 && timePassed>4)
        return {speaker:BOT, action:ANSWERING, intent:INTENTS.help, text:"Here are the things you can say:", list:getExampleIntents()};

    var last = scope.lastMsg;
    var prev = scope.msgs[scope.msgs.indexOf(last)-1];

    if(last==null) return null;

    switch (last.intent) {

        case INTENTS.greeting:
            return last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:getGreetingAnswer()} : null;

        case INTENTS.unresolved:
            return last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:getUnresolvedAnswer()} : null;
                
        case INTENTS.whatTimeIsIt:
            return last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:"It is " + new Date().toTimeString().substr(0,5)} : null;

        case INTENTS.pronounceGame:
            var game = scope.findMsg(INTENTS.pronounceGame);
            if(last.speaker==HUMAN){
                if(prev.intent==INTENTS.pronounceGame)
                    return {speaker:BOT, action:ANSWERING, intent:last.intent, text:last.text!=prev.word?"You should have said "+prev.word+". You said "+last.text:"Excellent!"};
                else
                    return {speaker:BOT, action:ASKING, intent:last.intent, word: words[Math.ceil(Math.random() * 10000)], prompt:"Ok. Here is a word. Say it!"};
            }
            else {
                if(last.action==ASKING)
                    return null;
                else if(game && !game.over && last!=game && last.time<timePassed-5)
                    return {speaker:BOT, action:ASKING, intent:last.intent, word: words[Math.ceil(Math.random() * 10000)], prompt:"Here is another word."};
                else
                    return null;
            }
                            
        case INTENTS.help:
            return last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:INTENTS.help, text:"Here are the things you can say:", list:getExampleIntents()} : null;
        
        case INTENTS.sayAgain:
            if(last.speaker == HUMAN){
                for(let i=scope.msgs.length-1; i>-1; i--)
                    if(scope.msgs[i].speaker==BOT)
                        return {speaker:BOT, action:scope.msgs[i].action, intent:scope.msgs[i].intent, text:scope.msgs[i].text, word:scope.msgs[i].word, prompt:scope.msgs[i].prompt, list:scope.msgs[i].list};
                return {speaker:BOT, action:ANSWERING, intent:last.intent, text:"There is nothing to say"};
            }
            else return null;
        
        case INTENTS.endGame:
            if(last.speaker == BOT)
                return null;

            var game = scope.findMsg(INTENTS.pronounceGame);
            if(game){
                if(game.over) return {speaker:BOT, action:ANSWERING, intent:last.intent, text:"Game is already over"};
                game.over = true;
                return {speaker:BOT, action:ANSWERING, intent:last.intent, text:"Ok. Game over!"};
            }
            return {speaker:BOT, action:ANSWERING, intent:last.intent, text:"There is no game."};
                        
        case INTENTS.askingName:
            return last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:"My name is Chatbot"} : null;
    
    }

}

function botWaitsForAnswer(){
    return scope.lastMsg && scope.lastMsg.speaker==BOT && scope.lastMsg.prompt;
}

function getExampleIntents(){
    var list = [];
    for(let intent in INTENTS){
        if(intent=='unresolved') continue;
        list.push(getExampleIntent(INTENTS[intent]));
    }
    return list;
}
function getExampleIntent(intent){
    switch (intent) {
        case INTENTS.whatTimeIsIt:
            return "What time is it?";
        case INTENTS.pronounceGame:
            return "Let's play pronunciation game";
        case INTENTS.sayAgain:
            return "Say the last word again";
        case INTENTS.help:
            return "Help";
        case INTENTS.askingName:
            return "What is your name?";
    }
    return intent;
}
