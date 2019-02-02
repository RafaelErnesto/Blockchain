const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const blockchain = require('./blockchain.js');
const uuid = require('uuid/v1');
const rp = require('request-promise');
const port = process.argv[2];


const nodeAddress = uuid().split('-').join('');
const bitcoin = new blockchain();

app.use(bodyParser.json());//parser for json data
app.use(bodyParser.urlencoded({extended:false}));//parser for url 


app.get('/blockchain',function(req,res){//get the entire blockchain
    res.send(bitcoin);
});

app.post('/transaction',function(req,res){//create a new transaction
    const blockIndex = bitcoin.createNewTransaction(req.body.amount,req.body.sender,req.body.recipient);
    res.json({note:`transaction will be added to block ${blockIndex}.`});
});

app.get('/mine',function(req,res){//will mine a new block
    const lastBlock = bitcoin.getLastBlock();

    const previousBlockHash = lastBlock["hash"];

    const currentBlockData = {
        transactions : bitcoin.pendingTransactions,
        index:lastBlock["index"]+1
    }

    const nonce = bitcoin.proofOfWork(previousBlockHash,currentBlockData);

    const blockHash = bitcoin.hashBlock(previousBlockHash,currentBlockData,nonce);

    bitcoin.createNewTransaction(12.5,'00',nodeAddress);

    const newBlock = bitcoin.createNewBlock(nonce,previousBlockHash,blockHash);

    res.json({note:"New block mined successfully.",block:newBlock});
});

//register a node and broadcast it on the network
app.post('/register-and-broadcast-node',function(req,res){
    const  newNodeUrl = req.body.newNodeUrl;//new node to be added to the network
   if(bitcoin.networkNodes.indexOf(newNodeUrl)==-1)  bitcoin.networkNodes.push(newNodeUrl);//if the node hasn't been added to this node, added it

   const regNodesPromises = [];//other nodes, that will be hit by the broadcast
    bitcoin.networkNodes.forEach(networkNodeUrll =>{//for each node
        const requestOptions = {
            uri:networkNodeUrll+'/register-node',
            method:'POST',
            body:{newNodeUrl:newNodeUrl},
            json:true
        }

        regNodesPromises.push(rp(requestOptions));
    });

    Promise.all(regNodesPromises)//broadcast
    .then(data =>{
        const bulkRegisterOption ={
            uri: newNodeUrl+'/register-node-bulk',
            method:'POST',
            body:{allNetworkNodes : [...bitcoin.networkNodes,bitcoin.currentNodeUrl]},
            json:true
        }
        return rp(bulkRegisterOption);
    })
    .then(data =>{
        res.json({note:"New node registered on the network."})
    })
});

//register a node
app.post('/register-node',function(req,res){
    const newNodeUrl = req.body.newNodeUrl;
    const notCurrentNodeUrl = bitcoin.currentNodeUrl!= newNodeUrl;
    if(bitcoin.networkNodes.indexOf(newNodeUrl)==-1 && notCurrentNodeUrl){
        bitcoin.networkNodes.push(newNodeUrl);
        res.json({note:"New node registered successfully."});
    }
  
});

//register multiples nodes at once
app.post('/register-node-bulk',function(req,res){
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(netWorkNodeUrl =>{
        const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(netWorkNodeUrl) == -1;
        const notCurrentNode = bitcoin.currentNodeUrl != netWorkNodeUrl;
        if(nodeNotAlreadyPresent && notCurrentNode) bitcoin.networkNodes.push(netWorkNodeUrl);
    });
    res.json({note:"Bulk registration  successfull."});
});


app.listen(port,function(){
    console.log(`Listening on port ${port}...`);
});
