// required imports for socket.io
var util = require("util");
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var Player = require("./player").Player;
var Deck = require("./deck").Deck;
var Card = require("./card").Card;
var Logic = require("./logic");

var socket;
var serverPort = process.argv[2];
var userSockets;

var players;
var connectedPlayers;
var currentHandPlayers;
var maxPlayers;
var playerConnected;
var raisePlayers;
var readyPlayers = 0;
var numTimesAccess = 0;
var playingPlayers;
var roundOver = false;
var indexPlayer = 1;
var again = 0;
var gameStage = 0;
var gameStages = ["preflop","flop", "turn", "river", "postriver"];
var usernames;

var deck;
var playerCards;
var tableCards;


function init() {
  // initialize variables once server starts
  connectedPlayers = [];
  currentHandPlayers = [];
  playingPlayers = [];
  playerCards = [];
  tableCards = [];
  userSockets = [];
  raisePlayers = [];
  usernames = [];
  maxPlayers = 4

  app.get('/*', function(req, res){
    var file = req.params[0];
      //Send the requesting client the file.
     res.sendFile( __dirname + '/client/' + file );
   });

  io.on('connection', function (socket) {
    socket.emit('welcome', { message: 'Welcome to the poker room, client!' });

		// When a new player comes in, onNewPlayer runs
		socket.on("new player", onNewPlayer);

		// When socket disconnects, call onsocketDisconnect
		socket.on("disconnect", onsocketDisconnect);

		// When socket presses ready button
		socket.on("ready", startGame);

		// When socket presses the leave button
		socket.on("leave", playerLeft);

		// Indicates the turn for the user
		socket.on("current turn", currentTurn);

		// Once players press the Ready Button
		socket.on("first turn", firstTurn);

		// Once players press any buttons
		socket.on("buttons", buttons);

		// Once players press fold
		socket.on("fold", fold);

		// Once players press call
		socket.on("call", currentTurn);

		// Once players bet
		socket.on("increase pot", potIncrease);

		socket.on("changed amount", amountChanged);
  });

  // Thanks to the Nick/the PoP team for helping with this code
	// Set to listen on this ip and this port.
	server.listen(serverPort, '0.0.0.0', function(){
		console.log("Game server started on port " + serverPort);
	});
};

// Called by sockets when they hit the Play button
function onNewPlayer(data) {

  util.log("Found a new player!" + data.username)

  var i, existingPlayer;
  // Stores each user's sockets by username
  userSockets.push({username: data.username, socket: this });


  var newPlayer = new Player(this.id, data.username, data.chips, connectedPlayers.length);

  // Store new player in each list
  playingPlayers.push(newPlayer);
  connectedPlayers.push(newPlayer);
  currentHandPlayers.push(newPlayer);
  usernames.push(newPlayer.getUsername());

  // Initialize a new list and push 4 players into it.
  outputArray = [];
  for (i = 0; i < maxPlayers; i++)
  {
    outputArray.push(new Player());
  }

  // Go through connectedPlayers list and provide the user info
  for (i = 0; i < connectedPlayers.length; i++) {
    existingPlayer = connectedPlayers[i];
    outputArray[existingPlayer.getTableIndex()] = {id: existingPlayer.id, username: existingPlayer.getUsername(),
												   chips: existingPlayer.getChips(), index: existingPlayer.getTableIndex()};
  };

  // Send playerArray to new player
  this.emit("new player", outputArray);

  // Send playerArray to existing players
  this.broadcast.emit("new player", outputArray);

  // Once two sockets connect, then show the Ready Button
  if (connectedPlayers.length ==  2) {
	  this.emit("ready");
	  this.broadcast.emit("ready");
  }

  // Once more than two people enter, show Ready Button
  if (connectedPlayers.length > 2) {
	  this.emit("ready");
  }

};

// Increase the pot to all players
function potIncrease(data) {
	this.emit("last bet", {chips: data.amount})
	this.emit("add to pot", {chips: data.chips, amount: data.amount});
	this.broadcast.emit("add to pot", {chips: data.chips, amount: data.amount});
}

//Restart the player list
function restartPlayerList() {
	currentHandPlayers = connectedPlayers.slice();
}

// Provides the turn signal and buttons for players
function buttons(data) {

	util.log("Ended in buttons");
	// Precaution for out of index

	// Remove the access sockets buttons
	this.emit("remove buttons");

	// Provide the next player in the list buttons
	for (var i = 0; i < userSockets.length; i++) {
		if(playingPlayers[indexPlayer].getUsername() == userSockets[i].username) {
			console.log("This is the user: " + userSockets[i].username);
			console.log("This is the length of playingPlayers: " + playingPlayers.length);
			console.log("This is the indexPlayer: " + indexPlayer);
			// Access the next player's socket
			var userSocket = userSockets[i].socket;
			// Provide that player the turn signal and buttons
			this.emit("signal", {username: userSockets[i].username });
			this.broadcast.emit("signal", {username: userSockets[i].username });
			userSocket.emit("add buttons");
		}
	}
	// next player
	util.log("INNNNNNNNDEXXXXX PLAYER IS INCREASING!!!!: " + indexPlayer);
	indexPlayer++;
	
    if (data.action == "fold") {
		if(indexPlayer > 0 && indexPlayer < playingPlayers.length) {
			indexPlayer--;
		}
    }
	
	if (indexPlayer >= playingPlayers.length) {
		indexPlayer = 0;
	}

	if (data.remove == true) {
		this.emit("remove buttons");
		this.broadcast.emit("remove buttons");
		return;
	}
}

function amountChanged(data) {
	this.emit("change amount",{username: data.id, chips: data.chips});
	this.broadcast.emit("change amount",{username: data.id, chips: data.chips});
}

// Enters this phase once players press the Ready Button
function firstTurn(data) {
	util.log("Ended in firstTurn");

	gameStage = 0; // preflop
	playingPlayers = connectedPlayers.slice();
    currentHandPlayers = connectedPlayers.slice();
	indexPlayer = 0;
	numTimesAccess++;
	util.log("numTimesAccess is " + numTimesAccess);
	util.log("curentHandPlayers is " + currentHandPlayers.length);
	// Until all users press the ready
	if ( numTimesAccess == currentHandPlayers.length) {
		
		if (playingPlayers[indexPlayer].getUsername() == userSockets[0].username) {
			console.log("This is the future!!!!!!!!!");
			indexPlayer++;
		}
		
		util.log("Inside the first turn");
		numTimesAccess = 0;
		// Accesses the first client that enters the room
		console.log("This is the userSocket[0].socket :" + userSockets[0].username);
		var userSocket = userSockets[0].socket;
		userSocket.emit("add buttons");
		userSocket.emit("signal", {username: userSockets[0].username});
		for(var i = 1; i < userSockets.length; i++) {
			userSocket = userSockets[i].socket;
			userSocket.emit("signal", {username: userSockets[0].username});
		}

		// Removes the first player from the remaining round players
		playerTurn = currentHandPlayers[0];
		currentHandPlayers.splice(0, 1);
	}
}

// Removes the player from the round
function fold(data) {
	util.log("Ended in fold");
	// Find the player and remove him from the round
	for (var i = 0; i < playingPlayers.length; i++) {
		if( playingPlayers[i].getUsername() == data.username ) {
			console.log(playingPlayers[i].getUsername() + " folded!!!!!!!!!");
			playingPlayers.splice(i, 1);
		}
	}
	
	if(indexPlayer >= playingPlayers.length) {
		indexPlayer = 0;
	}

	// If there is only one player left in the round
	if (playingPlayers.length == 1) {
		roundOver = true;
		// Access the currentPlayer
		var user = playingPlayers[0];
		// Remove all buttons
		this.emit("remove buttons");
		this.broadcast.emit("remove buttons");
		// Announce the winner of the round to all sockets
		this.emit("winning player", {player: user.getUsername()});
		this.broadcast.emit("winning player", {player: user.getUsername()});
		// Erase everything
		this.emit("round over");
		this.broadcast.emit("round over");
		// Restart the playing player list
		playingPlayers = connectedPlayers.slice();
	}
}

function currentTurn(data) {
	util.log("Ended in currentTurn");
	
	// If any player raised
 	if (data.action == "raise") {
 		// Make a new list with all players
 		currentHandPlayers = playingPlayers.slice();
 		// Look for the user that raised and erased him from list
 		for (var i = 0; i < currentHandPlayers.length; i++) {
 			if(data.user == currentHandPlayers[i].getUsername()) {
 				util.log("slicing user");
 				currentHandPlayers.splice(i, 1);
 			}
 		}
 	}
	
	// If all player decided their action for the turn
	if (currentHandPlayers.length == 0) {
		currentHandPlayers = playingPlayers.slice();
		if (roundOver == false) {
		    gameStage = (gameStage + 1) % 5;
		    stage = gameStages[gameStage];
		    util.log("the stage is " + stage);

		    if (stage == "flop")
			{
			    this.emit("flop cards", {value1 : tableCards[0].get_value(), suit1 : tableCards[0].get_suit(), value2 : tableCards[1].get_value(), suit2 : tableCards[1].get_suit(),value3 : tableCards[2].get_value(), suit3 : tableCards[2].get_suit()});
			    this.broadcast.emit("flop cards", {value1 : tableCards[0].get_value(), suit1 : tableCards[0].get_suit(), value2 : tableCards[1].get_value(), suit2 : tableCards[1].get_suit(),value3 : tableCards[2].get_value(), suit3 : tableCards[2].get_suit()});
			}
			else if (stage == "turn")
			{
			    this.emit("turn card", {value : tableCards[3].get_value(), suit : tableCards[3].get_suit()});
			    this.broadcast.emit("turn card", {value : tableCards[3].get_value(), suit : tableCards[3].get_suit()});
			}
			else if (stage == "river")
			{
			    this.emit("river card", {value : tableCards[4].get_value(), suit : tableCards[4].get_suit()});
			    this.broadcast.emit("river card", {value : tableCards[4].get_value(), suit : tableCards[4].get_suit()});
			}
			else if (stage == "postriver")
			{
				// Player's Card list
			    outputPlayerCards = [];
				var playerHands = {};
				var totalCards = tableCards.slice();
				var userResults = {};
				var times = 0;
				var result;
				
				// Puts each user cards inside a dictionary {user: {Card1: Card2:}}
				for (var i = 0; i < usernames.length; i++) {
					playerHands[usernames[i]] = {"Card1": playerCards[times], "Card2": playerCards[times+1]};
					times += 2;
				}
				
				times = 0;
				console.log("This is the playerCards length: " + playerCards.length);
				// Push a dictionary int to the card list with information of each card
			    for (var i = 0; i < playerCards.length; i++)
			    {
					 // inserting the info of the card
			         outputPlayerCards.push({value: playerCards[i].get_value(), suit: playerCards[i].get_suit(), owner: playerCards[i].get_owner()});
			         // Pushing the card value into the logic list
					 totalCards.push(playerCards[i]);
					 times++;
					 
					 if (times == 2) {
						// What hand the player has
						result = Logic.determineWinner(totalCards);
						console.log("\n");
						console.log("This is the result: " + result);
						console.log("\n");
						// Stores the results of each user
						userResults[playerCards[i].get_owner()] = result;
						// Restart the card list 
						totalCards = tableCards.slice();
						times = 0;
					 }
			    }
				
				// Iterate through the dictionary and see which is the higher result
				var userPoints = {};
				for (var i = 0; i < usernames.length; i++) {
					var str = userResults[usernames[i]];
					
					if (str.includes("Royal Flush")) {
						userPoints[usernames[i]] = 10;
					}
					else if(str.includes("Straight Flush")) {
						userPoints[usernames[i]] = 9;
					}
					else if(str.includes("four of a kind")) {
						userPoints[usernames[i]] = 8;
					}
					else if(str.includes("Full House")) {
						userPoints[usernames[i]] = 7;
					}
					else if(str.includes("Flush")) {
						userPoints[usernames[i]] = 6;
					}
					else if(str.includes("Straight")) {
						userPoints[usernames[i]] = 5;
					}
					else if(str.includes("three of a kind")) {
						userPoints[usernames[i]] = 4;
					}
					else if(str.includes("two pair")) {
						userPoints[usernames[i]] = 3;
					}
					else if(str.includes("pair")) {
						userPoints[usernames[i]] = 2;
					}
					else if(str.includes("High Card")) {
						userPoints[usernames[i]] = 1;
					}
				}
			 
			 	// Makes Final Evaluations if there are same results
				// I need to slice the list of usernames and delete the username for which there is a pair
				var addPoints;
				var user1Cards = tableCards.slice();
				var user2Cards = tableCards.slice();
				for (var i = 0; i < usernames.length; i++) {
					for(var j = 0; j < usernames.length; j++) {
						// If there are multiple of the same results
						if ((userPoints[usernames[i]] == userPoints[usernames[j]]) && (usernames[i] != usernames[j])) {
							// Provide the first user's full card list
							user1Cards.push(playerHands[usernames[i]]["Card1"]);
							user1Cards.push(playerHands[usernames[i]]["Card2"]);
							// Provide the second user's full card list
							user2Cards.push(playerHands[usernames[j]]["Card1"]);
							user2Cards.push(playerHands[usernames[j]]["Card2"]);
							// If the cards are bigger then increase the user points by 0.5
							console.log("This is user1 " + usernames[i]);
							console.log("This is user2 " + usernames[j]);
							addPoints = Logic.finalEvaluation(user1Cards,user2Cards,userResults[usernames[i]],userResults[usernames[j]]);
							console.log("This is the new Points " + addPoints);
							userPoints[usernames[i]] += addPoints;
							//totalCards = tableCards.slice();
							user1Cards = tableCards.slice();
							user2Cards = tableCards.slice();
						}
					}
				}
				
				// Decides the winner
				var winner;
				var high = 0;
				for (var i = 0; i < playingPlayers.length; i++) {
					util.log("This is the userPoints[usernames[i]]: " + userPoints[usernames[i]]);
					// need to only include from the list playingPlayers
					if (userPoints[playingPlayers[i].getUsername()] > high) {
						winner = playingPlayers[i].getUsername();
						high = userPoints[playingPlayers[i].getUsername()];
					}
					util.log("This is the high: " + high);
				}
				this.emit("winning player",{player: winner});
				this.broadcast.emit("winning player",{player: winner});

				// Inform every player which cards are who's
			    for (var i = 0; i < connectedPlayers.length; i++)
			    {
			         var userSocket = userSockets[i].socket;
			         userSocket.emit("other cards", outputPlayerCards);
			    }
				
				// Restart the list
			    playerCards = [];
			 }
		     this.emit("next action", gameStages[gameStage]);
			 this.broadcast.emit("next action", gameStages[gameStage]);
		 }
	 }
	
 	if (data.action == "raise") {
 		this.emit("player's action", {player: data.user, action: "raised", amount: data.amount});
 		this.broadcast.emit("player's action", {player: data.user, action: "raised", amount: data.amount});
	}
	else if (data.action == "call") {
 		this.emit("player's action", {player: data.user, action: "called", amount: data.amount});
 		this.broadcast.emit("player's action", {player: data.user, action: "called", amount: data.amount});
 	}
	else if (data.action == "fold") {
 		this.emit("player's action", {player: data.user, action: "folded", amount: 0});
 		this.broadcast.emit("player's action", {player: data.user, action: "folded", amount: 0});
 	}

	// Provide the next player in the list
    playerTurn = currentHandPlayers[0];
    currentHandPlayers.splice(0, 1);
	this.emit("current turn", {username: playerTurn.getUsername(),index: playerTurn.getTableIndex()});
	this.broadcast.emit("current turn", {username: playerTurn.getUsername(),index: playerTurn.getTableIndex()});
};

function startGame() {

	readyPlayers++;

	deck = new Deck();
	deck.get_new_deck();

	if (readyPlayers == connectedPlayers.length) {
		roundOver = false;
		readyPlayers = 0;
        for (i = 0; i < connectedPlayers.length; i++)
        {
        	var userSocket = userSockets[i].socket;
        	var card1 = deck.draw_card();
        	var user = connectedPlayers[i].getUsername();
        	card1.set_owner(user);
      	    var card2 = deck.draw_card();
            card2.set_owner(user);
            playerCards.push(card1, card2);
            userSocket.emit("client cards", {owner: user, value1 : card1.get_value(), suit1 : card1.get_suit(), value2 : card2.get_value(), suit2 : card2.get_suit()});
        }

        tableCards = [deck.draw_card(), deck.draw_card(), deck.draw_card(), deck.draw_card(), deck.draw_card()];

		this.emit("start game");
		this.broadcast.emit("start game");
	}
};

function playerLeft(data) {
	util.log("Printing here");
    util.log("Player has disconnected: " + this.id);

    var i;
    for (i = 0; i < connectedPlayers.length; i++ )
    {
      if (connectedPlayers[i].id == this.id)
      {
        connectedPlayers.splice(i, 1);
		this.emit("remove player", {id: this.id});
        this.broadcast.emit("remove player", {id: this.id});
        break;
      }
    }

	if (connectedPlayers.length == 0) {
	    connectedPlayers = [];
	    currentHandPlayers = [];
		playingPlayers = [];
	    playerCards = [];
		userSockets = [];
	}
};

// Disconnects each socket
function onsocketDisconnect() {
	util.log("Ended in onSocketDisconnect");
    util.log("Player has disconnected: " + this.id);

    var i;
    for (i = 0; i < connectedPlayers.length; i++ )
    {
      if (connectedPlayers[i].id == this.id)
      {
        connectedPlayers.splice(i, 1);
        this.broadcast.emit("remove player", {id: this.id});
        break;
      }
    }

	if (connectedPlayers.length == 0) {
	    connectedPlayers = [];
	    currentHandPlayers = [];
		playingPlayers = [];
	    playerCards = [];
		userSockets = [];
	}
};

function turn() {
	return Math.floor(Math.random()* connectedPlayers.length);
}

init();
