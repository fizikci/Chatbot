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
    endGame: "end-game",
    bookFlight: "book-flight"
};

var exampleIntents = ["Let's play pronunciation game", "Say the last word again", "Game over", "Book a flight"];

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
            
            if((msg.prompt && msg.speaker==BOT) || scope.msgs.length==1)
                speak(msg.prompt || msg.text, MOODS.normal, function(){
                    speechToText('', 1, function (results) {
                        scope.$apply(function(){
                            scope.addMsg({speaker:HUMAN, action:botWaitsForAnswer() ? ANSWERING : ASKING, intent:getIntent(results[0]), text:results[0]});
                        });
                    });
                });
        }

        scope.addMsg({speaker:BOT, action:ANSWERING, intent:INTENTS.help, text:"Welcome to English Learner's Chatbot! Here are the things you can say:", list:exampleIntents});

        scope.findContext = function(intent){
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
    text = text.toLowerCase();

    if (text=="hi" || text=="hey" || text=="hello")
        return INTENTS.greeting;
    else if (text.match(/what time/gi))
        return INTENTS.whatTimeIsIt;
    else if (text.match(/(pronoun|pronunci).+game/gi))
        return INTENTS.pronounceGame;
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
        return scope.lastMsg.intent;
    else
        return INTENTS.unresolved;
}

function getNextBotMsg() {

    var last = scope.lastMsg;
    var prev = scope.msgs[scope.msgs.indexOf(last)-1];

    if(last==null) return null;

    var game = scope.findContext(INTENTS.pronounceGame);
    var flight = scope.findContext(INTENTS.bookFlight);

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
                if(prev.intent==INTENTS.pronounceGame){
                    game.lastResultSuccess = wordsSame(last.text,prev.word);
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text: !game.lastResultSuccess ? "You should have said "+prev.word+". You said "+last.text : (prev.word+". Excellent!")};
                }
                else {
                    game.lastWord = words[Math.ceil(Math.random() * 10000)];
                    game.tryAgain = false;
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, word:game.lastWord , prompt:"Ok. Here is a word. Say it!"};
                }
            }
            else {
                if(last.action==ASKING)
                    msg = null;
                else if(game && !game.over && last!=game && last.time<timePassed-2){
                    if(game.lastResultSuccess){
                        game.lastWord = words[Math.ceil(Math.random() * 10000)];
                        game.tryAgain = false;
                    }else{
                        game.tryAgain = !game.tryAgain;
                        if(!game.tryAgain) game.lastWord = words[Math.ceil(Math.random() * 10000)];
                    }
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, word: game.lastWord, prompt:game.tryAgain?"Try again!":"Here is another word."};
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
                for(let i=scope.msgs.length-1; i>-1; i--)
                    if(scope.msgs[i].speaker==BOT){
                        msg = {speaker:BOT, action:scope.msgs[i].action, intent:scope.msgs[i].intent, text:scope.msgs[i].text, word:scope.msgs[i].word, prompt:scope.msgs[i].prompt, list:scope.msgs[i].list};
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
            else if(game){
                if(game.over) 
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"Game is already over"};
                else {
                    game.over = true;
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"Ok. Game over!"};
                }
            } 
            else msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"There is no game."};
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
                
                if(prev.asking) flight[prev.asking] = last.text;

                if(!flight.from)
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"from", prompt:"Where are you flying from?"};
                else if(!flight.to)
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"to", prompt:"Where are you flying to?"};
                else if(!flight.when)
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"when", prompt:"When do yo want to fly?"};
                else if(!flight.confirm)
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"confirm", prompt:`You want to fly from ${flight.from} to ${flight.to} ${flight.when}, don't you?`};
                else if(flight.confirm=="yes")
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:`Great! Here are the flights:`, list:['flight 1','flight 2']};
                else {
                    flight.over = true;
                    msg = null;
                }
            }
            break;
    }

    if(!msg && game && !game.over && last.intent!=INTENTS.pronounceGame && last.time<timePassed-2){
        game.over = true;
        msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"Game over by the way!"};
    }

    return msg;
}

function botWaitsForAnswer(){
    return scope.lastMsg && scope.lastMsg.speaker==BOT && scope.lastMsg.prompt;
}

function parseFlightRequest(flight){
    var str = flight.text;
    var res = str.match(/tomorrow|next week|next month/i);
    if(res){
        flight.when = res[0];
        str = str.replace(res[0],'');
    }

    res = str.match(/from (.+) to (.+)/i);
    if(res && res.length>0){
        flight.from = res[1];
        flight.to = res[2];
    }

    flight.parsed = true;
}