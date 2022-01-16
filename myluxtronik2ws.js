module.exports = function(RED) {
    "use strict";

    const WebSocket = require('ws');
    const zealit = require('zealit');
    zealit.option.catch = (err) => { throw "Illegal reference" }

    function processMessages(node, msg, socket, data, callbacks) {
        try {
            var parseString = require('xml2js').parseString;
            parseString(data, function(_, json) {
                var callback = callbacks.shift();
                if(callback !== undefined) {
                    callback(socket, zealit(json), callbacks)
                }
            });
        } catch (e) {
            socket.close();
            node.error(e, msg);
        }
    }

    function forwardOrSkip(node, msg, socket, json, condition, callbacks) {
        try {
            if(condition(json)) {
                var callback = callbacks.shift();
                if(callback !== undefined) {
                    callback(socket, json, callbacks)
                }
            }
            else {
                callbacks.unshift(function(_socket, _json, _callbacks){forwardOrSkip(node, msg, _socket, _json, condition, _callbacks)})
            }
        } catch (e) {
            socket.close();
            node.error(e, msg);
        }
    }

    function instLogin(node, msg, password, socket, json) {
        try {
            var index = json.Content.item.find(x => x.name[0] === 'Passwort')
            if (index !== undefined) {
                var message = 'SET;set_' + index.$.id + ';' + password;
                socket.send(message);
                socket.send('SAVE;1');
                socket.send("REFRESH");
            }
        } catch (e) {
            socket.close();
            node.error(e, msg);
        }
    }

    function getProperties(key, node, msg, socket, json) {
        try {
            var index = json.Navigation.item.find(x => x.name[0].startsWith(key))
            if (index !== undefined) {
                var message = 'GET;' + index.$.id;
                socket.send(message);
            }
        } catch (e) {
            socket.close();
            node.error(e, msg);
        }
    }

    function changeStoerung(node, msg, socket, json, value) {
        try {
            var index = json.Content.item.find(x => x.name[0] === 'System Einstellung')
            if (index !== undefined) {
                var index2 = index.item.find(x => x.name[0] === 'Störung')
                if (index2 !== undefined) {
                    var message = 'SET;set_' + index2.$.id + ';' + value; //0 mit ZWE; 1 ohne ZWE; 2 Heizung, 3 Warmwasser
                    socket.send(message);
                    socket.send('SAVE;1');
                }
            }
        } catch (e) {
            socket.close();
            node.error(e, msg);
        }
    }

    function printOutAndForward(node, msg, result, socket, json, callbacks) {
        try {
            for (var i in json.Content.item) {
                result[json.Content.item[i].name[0]] = {};
                for (var j in json.Content.item[i].item) {
                    result[json.Content.item[i].name[0]][json.Content.item[i].item[j].name[0]] = {};
                    result[json.Content.item[i].name[0]][json.Content.item[i].item[j].name[0]]["value"] = 
                        json.Content.item[i].item[j].value[0];
                    
                    if('option' in json.Content.item[i].item[j])
                    {
                        result[json.Content.item[i].name[0]][json.Content.item[i].item[j].name[0]]["option"] = {};
                        for(var k in json.Content.item[i].item[j].option) {
                            result[json.Content.item[i].name[0]][json.Content.item[i].item[j].name[0]].option[k] = {};
                            result[json.Content.item[i].name[0]][json.Content.item[i].item[j].name[0]].option[k]["value"] = 
                                json.Content.item[i].item[j].option[k].$.value;
                            result[json.Content.item[i].name[0]][json.Content.item[i].item[j].name[0]].option[k]["meaning"] = 
                                json.Content.item[i].item[j].option[k]._;
                        }
                    }
                }
            }
            var callback = callbacks.shift();
            if(callback !== undefined) {
                callback(socket, json, callbacks)
            }
        } catch (e) {
            socket.close();
            node.error(e, msg);
        }
    }

    function storeJsonAndForward(node, msg, storeJson, socket, json, callbacks) {
        try {
            storeJson.json = json;
            var callback = callbacks.shift();
            if(callback !== undefined) {
                callback(socket, json, callbacks)
            }
        } catch (e) {
            socket.close();
            node.error(e, msg);
        }
    }

    function validate(param, value) {
        switch (param) {
            case 'stoerung':
                if(typeof(value) === 'string'){
                    return value.match(/^0|1|2|3$/);
                }
                else {
                    if(typeof(value) === 'number'){
                        return value > -1 && value < 4;
                    }
                    else {
                        return false;
                    }
                }
            default:
                return false;
        }
    }

    function MyLuxtronik2WsSet(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        const uri = 'ws://' + config.host + ':' + config.port;
        const login = "LOGIN;" + config.password;
        const instPassword = config.instPassword

        node.on('input', function (msg) {
            var parameterName = config.parameter;
            var parameterValue = msg.payload;

            if(validate(parameterName, parameterValue)){
                switch (parameterName) {
                    case 'stoerung':
                    {
                        var callbacks = [
                            function(_socket, json, _callbacks){forwardOrSkip(node, msg, _socket, json, function(json)
                                {return 'Navigation' in json;},_callbacks)},
                            function(_socket, json){getProperties("Zugang", node, msg, _socket, json)},
                            function(_socket, json, callbacks){instLogin(node, msg, instPassword, _socket, json, callbacks)},
                            function(_socket, json, _callbacks)
                                {forwardOrSkip(node, msg, _socket, json, function(json){return 'Navigation' in json;},_callbacks)},
                            function(_socket, json){getProperties("Einstellungen", node, msg, _socket, json)},
                            function(_socket, json, _callbacks)
                                {forwardOrSkip(node, msg, _socket, json, function(json)
                                    {return 'Content' in json && 'item' in json.Content && 
                                        json.Content.item.find(x => x.name[0] === 'System Einstellung') !== undefined;}, _callbacks)},
                            function(_socket, json){changeStoerung(node, msg, _socket, json, parameterValue)}
                            ];

                        var socket  = new WebSocket(uri, 'Lux_WS')
                        socket.on('open', function open() {
                            try {
                                socket.on('message', (data) => {
                                    processMessages(node, msg, socket, data, callbacks);
                                });

                                socket.send(login);
                                socket.send("REFRESH");
                            } catch (e) {
                                socket.close();
                                node.error(e, msg);
                            }
                        });
                    }
                }
            }
            else {
                node.error("Invalid parameter value", msg);
            }
        });
    }

    RED.nodes.registerType("myLuxtronik2ws-set", MyLuxtronik2WsSet);

    function MyLuxtronik2WsGet(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        const uri = 'ws://' + config.host + ':' + config.port;
        const login = "LOGIN;" + config.password;

        node.on('input', function (msg) {
            var overviewJson = {}
            overviewJson["json"] = {}
            var resultMessage = {};
            resultMessage["Informationen"] = {}
            resultMessage["Einstellungen"] = {}

            var callbacks = [
                function(_socket, json, _callbacks){forwardOrSkip(node, msg, _socket, json, function(json){return 'Navigation' in json;}, _callbacks)},
                function(_socket, json, _callbacks){storeJsonAndForward(node, msg, overviewJson,_socket, json, _callbacks)},
                function(_socket, json, _callbacks){getProperties("Informationen", node, msg, _socket, json)},
                function(_socket, json, _callbacks)
                    {forwardOrSkip(node, msg, _socket, json, function(json){return 'Content' in json && 'item' in json.Content && 
                        json.Content.name[0] === 'Informationen';}, _callbacks)},
                function(_socket, json, _callbacks){printOutAndForward(node, msg, resultMessage["Informationen"], _socket, json, _callbacks)},
                function(_socket){getProperties("Einstellungen", node, msg, _socket, overviewJson.json)},
                function(_socket, json, _callbacks)
                    {forwardOrSkip(node, msg, _socket, json, function(json){return 'Content' in json && 'item' in json.Content && 
                        json.Content.item.find(x => x.name[0] === 'System Einstellung') !== undefined;}, _callbacks)},
                function(_socket, json, _callbacks){printOutAndForward(node, msg, resultMessage["Einstellungen"], _socket, json, _callbacks)},
                function(){msg.payload = resultMessage; try { node.send(msg) } catch (e) {socket.close(); node.error(e, msg);}}
                ];

            var socket  = new WebSocket(uri, 'Lux_WS')
            socket.on('open', function open() {
                try {
                    socket.on('message', (data) => {
                        processMessages(node, msg, socket, data, callbacks);
                    });

                    socket.send(login);
                    socket.send("REFRESH");
                } catch (e) {
                    socket.close();
                    node.error(e, msg);
                }
            });
        });
    }

    RED.nodes.registerType("myLuxtronik2ws-get", MyLuxtronik2WsGet);
}