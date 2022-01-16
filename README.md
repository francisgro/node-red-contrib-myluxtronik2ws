## node-red-contrib-myluxtronik2ws
A Node-Red module which enables read/write access to Luxtronik2 heat pump controllers via WebSockets (firmware version >= 3.81).

This work is inspired by [node-red-contrib-luxtronik2@github](https://github.com/coolchip/node-red-contrib-luxtronik2) and [node-red-contrib-luxtronik2-ws@github](https://github.com/Bouni/node-red-contrib-luxtronik2-ws). It is an extention with a first example for setting heat pump parameters. 

**Disclaimer: Use at your own risk! I do not provide any guarantees that this software works with your heat pump or that it is free of bugs.Write access to the heat pump could potentially lead to negative effects. You should know what you are doing.**

### Installation
1. Clone this project to ```<YourPath>```.
2. ```cd <YourPath> && npm install```
3. Switch to your Node-Red installation, by default $HOME/.node-red.
4. ```npm install <YourPath>```

### How to use
#### Reading heat pump data
1. Drag the node myluxtronik2ws-get into the flow.
2. Configure IP address, port and web interface password as per your needs.
3. Reading is triggered by an arbitrary input message.
4. Heat pump data is returned as complex JS object.

#### Changing heat pump parameters
1. Drag the node myluxtronik2ws-set into the flow.
2. Configure IP address, port, web interface password and installer password as per your needs.
3. Select the parameter you want to change. Currently, only "Störung" is supported which sets usage of the ZWE in case heat pump goes into error state. (See further documentation attached to the node.)
4. Send the value as message payload to the node in order to trigger setting process.

#### TODO
This work is just a starting point. Please feel free to contribute, especially in terms of extending parameter setting. I have not the time to actively maintain this software, so please do not expect frequent updates.