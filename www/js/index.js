var scope = null;

setTimeout(function(){
    scope.$apply(function(){
        if(scope.cards.length==0)
            scope.cards.push({ intent: 'unresolved', data: 'Hey there! I am Chatbot.' });
    });
}, 10000);

angular.module('pronounceApp', [])
    .controller('MainController', function ($scope) {

        checkSpeech();

        scope = $scope;

        $scope.micAvailable = micAvailable;

        $scope.cards = [];

        $scope.getVoice = function () {
            if (!micAvailable || $scope.input) {
                $scope.cards.push({ intent: 'question', data: $scope.input || '???' });
                $scope.cards.push(getAnswer($scope.input || ''));
                $scope.input = '';
            }
            else
                speechToText('', 1, function (results) {
                    var text = results[0];
                    $scope.$apply(function () {
                        $scope.cards.push({ intent: 'question', data: text });
                        $scope.cards.push(getAnswer(text));
                    });
                });
        }

    });

var INTENTS = {
    unresolved: "unresolved",
    whatTimeIsIt: "what-time-is-it",
    pronounceGame: "pronounce-game",
};

function getAnswer(text) {
    var intent = getIntent(text);
    return {
        intent: intent,
        data: getData(intent)
    };
}

function getIntent(text) {
    text = text.toLowerCase().trim();
    if (text == "what time is it")
        return INTENTS.whatTimeIsIt;
    else if (text == "let's play pronounce game")
        return INTENTS.pronounceGame;
    else if (text == "pronounce game")
        return INTENTS.pronounceGame;
    else if (text == "ask me a word")
        return INTENTS.pronounceGame;
    else
        return INTENTS.unresolved;
}

function getData(intent) {
    switch (intent) {
        case INTENTS.unresolved:
            var data = "Sorry, I couldn't understand what you said.";
            if (micAvailable)
                TTS.speak({ text: data, locale: lang, rate: 1 });
            return data;
        case INTENTS.whatTimeIsIt:
            var time = "It is " + new Date().getHours() + ":" + new Date().getMinutes();
            if (micAvailable)
                TTS.speak({ text: time, locale: lang, rate: 1 });
            return time;
        case INTENTS.pronounceGame:
            var prompt = "Ok. Here is the word. Say it!";
            var data = {word: words[Math.ceil(Math.random() * 10000)], prompt:prompt};
            if (micAvailable) 
                TTS.speak({ text: prompt, locale: lang, rate: 1 }, function(){
                    scope.$apply(function(){
                        speechToText("say "+data.word, 3, function(results){
                            scope.$apply(function(){
                                scope.cards.push({
                                    intent:'question',
                                    data: results[0]
                                });
                                var index = results.indexOf(data.word);
                                scope.cards.push({
                                    intent:'pronounce-game-res',
                                    data: {score:index==-1?0:(3-index), results:results}
                                });
                            });
                        });
                    });
                });
            return data;
    }
}


