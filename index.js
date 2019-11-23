class Combat {
    constructor() {
        this.fighting = false
        this.enemies = []
        this.fightCommands = ["kick", "dodge"]
    }
    // this will kill any enemy seen in the room
    parseCommand(text) {
        // check entered command for expansion need?
        // this should happen before the sending to the websocket
        if (/kill (.*)/.exec(text)) {
            this.enemies.push(/kill (.*)/.exec(text)[1])
        }
    }
    search(text) {
        // look through the room text for a killable target
        // this initiates the fight
        if (!this.fighting) {
            let enemy_array = this.enemies
            for (let enemy of enemy_array) {
                let reg = new RegExp(enemy, "g")
                if (reg.exec(text)) {
                    this.fighting = true
                    this.target = enemy
                    return `kill ${enemy}`
                }
            }
        }
        // this stuff should occur during
        // this ends the fight
        if (/corpse/.exec(text) || /They aren't here/.exec(text)) {
            this.fighting = false
        }
    }
}

class Exit {
    constructor() {
        this.possibleExits = []
    }
    search(text) {
        if (/\[ Exits: (.*) \]/.exec(text)) {
            let exits = /\[ Exits: (.*) \]/.exec(text)[1].split(" ")
            this.possibleExits = exits
        }
    }
    selectExit() {
        if (this.possibleExits.length > 0) {
            // get random possible exit
            let randI = Math.floor(Math.random() * this.possibleExits.length)
            let selected = this.possibleExits[randI]
            return this.possibleExits.splice(randI, 1)
        }
    }
}


// create the websocket
class Client {
    constructor() {
        this.combat = new Combat()
        this.exit = new Exit()
        this.ta = document.createElement("textarea")
        this.ta.id = "log"
        document.body.append(this.ta)
        this.inp = document.createElement("input")
        this.inp.id = "commands"
        this.inp.type = "text"
        this.inp.addEventListener("keydown", (e) => { this.sendInput(e) })
        document.body.append(this.inp)
        this.socketSetup()
        this.automoveswitch = false
        // setup the tool for keeping the scroll position while we aren't at the bottom
        this.stayBottomLocked = true
        this.scrollControl()
    }
    scrollControl() {
        this.ta.addEventListener("scroll", (e) => {
            // figure out what the position is of the scroll, and if its not 1 windows height down, enable a flag that stops us from tracking to the bottom when more stuff comes in
            console.log("scrolling")
            console.log("height", this.ta.scrollHeight)
            console.log("top", this.ta.scrollTop)
            let percentage = (this.ta.scrollTopMax - this.ta.scrollTop) / this.ta.scrollTopMax
            console.log("percentage", percentage)
            if (percentage > 0) {
                console.log("locking")
                this.stayBottomLocked = false
            } else {
                this.stayBottomLocked = true
            }
        })
    }

    automove(text) {
        // shift to all tn messages going through an identifier
        if (/automove/.exec(text)) {
            if (!this.automoveswitch) {
                this.automoveswitch = true
                this.autoInterval = setInterval(() => {
                    if (!this.combat.fighting) {
                        let pick = this.exit.selectExit()
                        if (pick) {
                            console.log("moving ", pick)
                            this.ws.send(pick)
                        }
                    }
                }, 4000)
            } else {
                clearInterval(this.autoInterval)
                this.automoveswitch = false
            }
            return true
        }
        return false
    }
    socketSetup() {
        this.ws = new WebSocket("ws://localhost:8765")
        this.ws.onopen = (e) => {
            // send thhe register request
            // retrieve and associate with the id
            this.ws.send("register")
        }
        this.ws.onmessage = (e) => {
            // if its a id response associate with attribute on this
            if (/id(\d+)/.exec(e.data)) {
                this.telnetID = /id(\d+)/.exec(e.data)[1]
            }
            // only update with correct info
            let text = /(\d+)--(.*)/.exec(e.data)
            if (text && text[1] == this.telnetID) {
                this.updateTextArea(text[2])
                if (this.ta.value.length > 10000) {
                    this.ta.value = this.ta.value.slice(1500)
                }
                if (this.stayBottomLocked) {
                    this.ta.scrollTop = this.ta.scrollHeight
                }
            }
        }
    }
    sendInput(e) {
        console.log(e.key)
        if (e.key == "Enter") {
            // check for combat elements
            this.combat.parseCommand(e.target.value)
            if (this.automove(e.target.value)) {
                console.log("automoving")
            } else {
                this.ws.send(`${this.telnetID}--${e.target.value}`)
            }
            e.target.value = ""
        }
    }
    updateTextArea(t) {
        this.ta.value += t
        let autoResponse = this.combat.search(t)
        this.exit.search(t)
        if (autoResponse) {
            this.ws.send(autoResponse)
        }
    }


}

let Mazer = () => {
    let ob = {}
    ob.current = [0, 0]
    ob.starting = (x, y) => {
        ob.width = x
        ob.height = y
        ob.makeArray()
    }
    ob.makeArray = () => {
        ob.exploredArray = Array(ob.width * ob.height).fill(".")
    }

    ob.getxy = (x, y) => {
        let ind = y * ob.width + x
        if (ind >= 0 && ind > ob.exploredArray.length - 1 && ob.exploredArray[ind] != "X") {
            return ind
        }
        return -1
    }
    ob.backtrack = []
    ob.step = () => {
        let options = [
            [-1, 0], [1, 0], [0, -1], [0, 1]
        ]
        let dir = -1
        let dirInd
        let newInds = []
        let back = false
        while (dir == -1) {
            if (options.length == 0) {
                // break and pop from stack
                dir = ob.backtrack.pop()
                back = true
                break
            }
            dirInd = Math.floor(Math.random() * 4)
            console.log(dirInd)
            let selectOpt = options.splice(dirInd, 1)
            newInds[0] = selectOpt[0]
            newInds[1] = selectOpt[1]

            // remove that option
            dir = ob.getxy(newInds[0] + ob.current[0], newInds[1] + ob.current[1])

        }
        if (back) {
            // we went back so don't add to the backtrack
        } else {
            // add the inverse to the backtrack
            backtrack.push([-1 * dir[0], -1 * dir[1]])
        }
        ob.exploredArray[dir] = "X"
        ob.current = [ob.current[0] + newInds[0], ob.current[1] + newInds[1]]
        // go in that direction, 
        ob.print()

    }
    ob.print = () => {
        for (let i = 0; i < ob.height; i++) {
            let row = ob.exploredArray.slice(i * ob.width, (i + 1) * ob.width)
            console.log(JSON.stringify(row))
            console.log("\n")
        }
    }
    return ob
}


window.onload = () => {
    let client = new Client()
    // create mazer
    //let maze = Mazer()
    //maze.starting(20, 20)
    //window.addEventListener("keydown", (e) => {
    //    if (e.key == "a") {
    //        maze.step()
    //    }
    //})
}