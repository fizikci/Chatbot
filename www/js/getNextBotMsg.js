async function getNextBotMsg() {
    
    if(!_) return null; //***

    var last = _.lastMsg;
    var prev = _.msgs[_.msgs.indexOf(last)-1];

    if(last==null) return null; //***

    gettingNextBotMsg = true;

    var flight = _.findContext(INTENTS.bookFlight);

    var msg = null;

    switch (last.intent) {

        // WELCOME
        case INTENTS.welcome:
            if(last.speaker==HUMAN){
                if(prev.asking) {
                    if(prev.asking=='nativeLang'){
                        _.db.nativeLang = getLanguage(last.text);
                        if(_.db.nativeLang){
                            msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:'Your native language has been set to '+last.text};
                            saveLocalData();
                        }else
                            msg = {speaker:BOT, action:ANSWERING, intent:last.intent, asking:"nativeLang", text:last.text+' is not a supported language', prompt:'Please say one of these languages:', list:Enumerable.From(langs).Where(o=>typeof o.Value=='string').Select(o=>capitalize(o.Key)).ToArray()};
                    } 
                    else if(prev.asking=='level'){
                        _.db.level = getLevel(last.text);
                        if(_.db.level>-1){
                            msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:'Your level has been set to '+last.text};
                            saveLocalData();
                        }else
                            msg = {speaker:BOT, action:ANSWERING, intent:last.intent, asking:"level", text:last.text+' is not a supported level.', prompt:'Please say one of these levels:', list:Enumerable.From(LEVELS).Where(o=>typeof o.Value=='number').Select(o=>capitalize(o.Key)).ToArray()};
                    } 
                }
            } else if(!last.asking) {
                if(!_.db.nativeLang)
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"nativeLang", prompt:"What is your native language?", list:Enumerable.From(langs).Select(o=>o.Key[0].toUpperCase()+o.Key.substr(1)).ToArray()};
                else if(_.db.level==-1)
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, asking:"level", prompt:"What is your English level?", list:Enumerable.From(LEVELS).Select(o=>o.Key[0].toUpperCase()+o.Key.substr(1).toLowerCase()).ToArray()};
                else
                    msg = {speaker:BOT, action:ANSWERING, intent:INTENTS.help, text:"Try saying one of these:", list:exampleIntents};
            }
            else 
                msg = null;
            break;

        // GREETING
        case INTENTS.greeting:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:getGreetingAnswer()} : null;
            break;

        // UNRESOLVED
        case INTENTS.unresolved:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:getUnresolvedAnswer()} : null;
            break;
        
        // WHAT TIME IS IT
        case INTENTS.whatTimeIsIt:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:"It is " + new Date().toTimeString().substr(0,5)} : null;
            break;

        // PRONOUNCE GAME
        case INTENTS.pronounceGame:
            if(last.speaker==HUMAN){
                if(prev.intent==INTENTS.pronounceGame){ // ongoing game
                    _.game.lastResultSuccess = wordsSame(last.text,prev.word);
                    if(!_.game.lastResultSuccess && _.game.tryAgain) addWordToBadPronounceList(_.game.lastWord);
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text: !_.game.lastResultSuccess ? "You should have said "+prev.word+". You said "+last.text : (prev.word+". "+getBravoAnswer()), mood:_.game.lastResultSuccess?MOODS.excited:MOODS.sad};
                }
                else { // new game
                    _.game = last;
                    _.game.iteration = 1;
                    _.game.lastWord = getRandomWord(1);
                    _.game.tryAgain = false;
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, word:_.game.lastWord, micPrompt:_.game.lastWord, prompt:"Ok. Here is a word. Say it!"};
                }
            }
            else {
                if(last.action==ASKING) // bot is waiting answer
                    msg = null;
                else if(_.game && last!=_.game){
                    if(_.game.lastResultSuccess){
                        if(!_.game.tryAgain) addWordToGoodPronounceList(_.game.lastWord);
                        _.game.lastWord = getRandomWord(1);
                        _.game.tryAgain = false;
                    }else{
                        _.game.tryAgain = !_.game.tryAgain;
                        if(!_.game.tryAgain) _.game.lastWord = getRandomWord(1);
                    }
                    msg = {speaker:BOT, action:ASKING, intent:last.intent, word: _.game.lastWord, micPrompt:_.game.lastWord, prompt:_.game.tryAgain?"Try again!":"Here is another word."};
                    _.game.iteration++;
                }
                else
                    msg = null;
            }
            break;
        
        // VOCABULARY GAME
        case INTENTS.vocabularyGame:
            if(last.speaker==HUMAN){
                if(prev.intent==INTENTS.vocabularyGame){ // ongoing game
                    _.game.lastResultSuccess = _.game.lastAsk=='en' ? wordsSameAny(last.text, _.game.lastTrans[1]) : wordsSameAny(last.text, _.game.lastTrans[0]);
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, 
                        text: !_.game.lastResultSuccess ? 
                                getFailAnswer() + " Correct answer could be " 
                                    : 
                                (getBravoAnswer() + ' It is correct.'), 
                        mood: _.game.lastResultSuccess ? MOODS.excited : MOODS.sad,
                        readList: !_.game.lastResultSuccess,
                        list: !_.game.lastResultSuccess ? (_.game.lastAsk=='en' ? _.game.lastTrans[1] : _.game.lastTrans[0]) : null,
                        listLang: _.game.lastAsk!='en' ? lang : _.db.nativeLang};
                }
                else { // new game
                    _.game = last;
                    _.game.iteration = 1;
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:`Ok. Translate the words...`};
                }
            }
            else {
                if(last.action==ASKING) // bot is waiting answer
                    msg = null;
                else if(_.game && last!=_.game){
                    _.game.lastTrans = null;
                    while(_.game.lastTrans==null)
                        try{ _.game.lastTrans = await translate(getRandomWord());} catch{}
                    if(_.game.lastTrans){
                        _.game.lastAsk = Math.random() >= .5 ? 'en' : 'tr'; // tr: translation
                        msg = {speaker:BOT, action:ASKING, intent:last.intent, prompt: _.game.lastAsk=='en' ? _.game.lastTrans[0][0] : _.game.lastTrans[1][0], micLang:_.game.lastAsk=='en' ? _.db.nativeLang:'en-US', lang:_.game.lastAsk=='en' ? 'en-US':_.db.nativeLang};
                        _.game.iteration++;
                    }
                    else
                        msg = null;
                }
                else
                    msg = null;
            }
            break;
        
        // HELP
        case INTENTS.help:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:INTENTS.help, text:"Here are the things you can say:", list:getExampleIntents()} : null;
            break;
        
        // SAY AGAIN
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
        
        // END GAME
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
        
        // ASKING NAME
        case INTENTS.askingName:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:"My name is Chatbot"} : null;
            break;

        // BOOK FLIGHT
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

        // DEFINE WORD
        case INTENTS.define:
            if(last.speaker==HUMAN){
                last.word = last.text.match(/define (.+)\b/i)[1];
                last.text = 'define:';
                msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:'Searching '+last.word+'...', asyncList:'waiting', mood:MOODS.excited};
                
                define(last.word)
                    .then(res=>{
                        _.$apply(function(){
                            msg.asyncList = res;
                            setTimeout(scrollToBottom, 100);
                        });
                    });
            }
            break;
        
        // ADD WORD TO LIST
        case INTENTS.addWordToList:
            if(last.speaker==HUMAN){
                var defineMsg = _.findContext(INTENTS.define);
                if(!defineMsg || !defineMsg.word)
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:"No word in context"};
                else {
                    var listName = last.text.match(/add (last word|it)* *to( the)* list ([a-z ]+)/i)[3];
                    if(!_.db.lists[listName]) _.db.lists[listName] = [];
                    _.db.lists[listName].push(defineMsg.word);
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:`added ${defineMsg.word} to the list ${listName}`};
                }
            }
            break;

        // LIST LISTS
        case INTENTS.listLists:
            msg = last.speaker==HUMAN ? {speaker:BOT, action:ANSWERING, intent:last.intent, text:"Here are your lists:", list:Enumerable.From(_.db.lists).Select(x=>x.Key).ToArray()} : null;
            break;

        // SHOW WORDS IN LIST
        case INTENTS.showList:
            if(last.speaker==HUMAN){
                var listName = last.text.match(/show words in( the)*( list)* ([a-z ]+)/i)[3];
                msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:listName+":", list:_.db.lists[listName]};
            }
            break;
        
        // SHOW STATS
        case INTENTS.showStats:
            if(last.speaker==HUMAN){
                var resultSet = {
                    data:[
                        ['Native Language', langs.getName(_.db.nativeLang)],
                        ['Level', LEVELS.getName(_.db.level)],
                        ['Number of Words', words.length],
                        ['Good pronounced', _.db.lists['good pronounce'].length],
                        ['Bad pronounced', _.db.lists['bad pronounce'].length]
                    ]
                };
                msg = {speaker:BOT, action:ANSWERING, intent:last.intent, resultSet:resultSet};
            }
            break;

        // DEV
        case INTENTS.dev:
            if(last.speaker==HUMAN){
                var res = '';
                try{res = eval(`(${last.text.substr(4)})`);}
                catch(e){res = e.toString();}
                
                if(!res)
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:'null'};
                else if(typeof res == 'object'){
                    if(res.length)
                        msg = {speaker:BOT, action:ANSWERING, intent:last.intent, resultSet:{columns:new Reflector(res[0]).getProperties(), data:Enumerable.From(res).Select(e=>new Reflector(e).getValues()).ToArray()}};
                    else{
                        var entries = new Reflector(res).getEntries();
                        if(entries.length)
                            msg = {speaker:BOT, action:ANSWERING, intent:last.intent, resultSet:{data:entries}};
                        else
                            msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:JSON.stringify(res)};
                    }
                }
                else
                    msg = {speaker:BOT, action:ANSWERING, intent:last.intent, text:res.toString()};
            }
            break;
        }

    //if(!msg && _.game && INTENTS.getKey(last.intent).indexOf('game')==-1 && last.time<timePassed-2)
    //    _.game = null;

    gettingNextBotMsg = false;

    return msg;
}
