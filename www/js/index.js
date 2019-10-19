var scope = null;

setTimeout(function(){
    scope.$apply(function(){
        if(scope.cards.length==0)
            scope.addCard({ intent: 'unresolved', data: 'Hey there! I am Chatbot.' });
    });
}, 10000);

angular.module('pronounceApp', [])
    .controller('MainController', function ($scope) {

        checkSpeech();

        scope = $scope;

        $scope.micAvailable = micAvailable;

        $scope.cards = [];

        $scope.addCard = function(card){
            $scope.cards.push(card);
            setTimeout(function(){
                var objDiv = document.getElementById("cardContainer");
                objDiv.scrollTop = objDiv.scrollHeight;
            }, 200);
        }

        $scope.getVoice = function () {
            if (!micAvailable || $scope.input) {
                $scope.addCard({ intent: 'question', data: $scope.input || '???' });
                $scope.addCard(getAnswer($scope.input || ''));
                $scope.input = '';
            }
            else
                speechToText('', 1, function (results) {
                    var text = results[0];
                    $scope.$apply(function () {
                        $scope.addCard({ intent: 'question', data: text });
                        $scope.addCard(getAnswer(text));
                    });
                });
        }

    });

var INTENTS = {
    unresolved: "unresolved",
    whatTimeIsIt: "what-time-is-it",
    pronounceGame: "pronounce-game",
    askingName: "asking-name"
};

function getAnswer(text) {
    var intent = getIntent(text);
    var data = getData(intent); 
    var res = {
        intent: intent,
        data: data,
        isString: typeof data == 'string'
    };
    if (micAvailable && res.isString)
        TTS.speak({ text: res.data, locale: lang, rate: 1 });
    return res;
}

function getIntent(text) {
    if (text.match(/what time/gi))
        return INTENTS.whatTimeIsIt;
    else if (text.match(/pronoun|pronunci/gi))
        return INTENTS.pronounceGame;
    else if (text.match(/your.+name/gi))
        return INTENTS.askingName;
    else
        return INTENTS.unresolved;
}

function getData(intent) {
    switch (intent) {

        case INTENTS.unresolved:
            return getUnresolvedAnswer();
        
        case INTENTS.whatTimeIsIt:
            return "It is " + new Date().getHours() + ":" + new Date().getMinutes();

        case INTENTS.pronounceGame:
            var prompt = "Ok. Here is a word. Say it!";
            var data = {word: words[Math.ceil(Math.random() * 10000)], prompt:prompt};
            if (micAvailable) 
                TTS.speak({ text: prompt, locale: lang, rate: 1 }, function(){
                    scope.$apply(function(){
                        speechToText("say "+data.word, 3, function(results){
                            scope.$apply(function(){
                                scope.addCard({
                                    intent:'question',
                                    data: results[0]
                                });
                                var score = 3 - results.indexOf(data.word); if(score>results.length) score = 0;
                                var say = getScoreAnswer(score);
                                TTS.speak({ text: say, locale: lang, rate: 1 });
                                scope.addCard({
                                    intent:'pronounce-game-res',
                                    data: {score:score, results:results, say:say}
                                });
                            });
                        });
                    });
                });
            return data;

        case INTENTS.askingName:
            return "My name is Chatbot";
    
    }
}


