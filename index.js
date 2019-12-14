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
                // look for the line A ... 
                if (/A (\w+)/.exec(text)) {
                    this.fighting = true
                }
            }
        }
        // this stuff should occur during
        // this ends the fight
        if (/R\.I\.P\./.exec(text) || /They don't seem to be here./.exec(text)) {
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
        this.travel = []
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

    randDir() {
        let ind = Math.floor(Math.random() * 4)
        return "nesw".slice(ind, ind + 1)
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
                console.log("telnet id is", this.telnetID)
            } else {
                let text = /(\d+)--(.*)/.exec(e.data)
                console.log(text)
                if (text && text[1] == this.telnetID) {
                    this.updateTextArea(`\n${text[2]}`)
                    if (this.ta.value.length > 10000) {
                        this.ta.value = this.ta.value.slice(1500)
                    }
                    if (this.stayBottomLocked) {
                        this.ta.scrollTop = this.ta.scrollHeight
                    }
                }
            }
            // only update with correct info
        }
    }
    idsend(s) {
        this.ws.send(`${this.telnetID}--${s}`)
    }
    autodig(s) {
        if (/autodig.*/.exec(s)) {
            this.digint = setInterval(() => {
                //move south
                let parts = /autodig (.*) (\d+)/.exec(s)
                let dirs = parts[1].split(" ")

                for (let step of dirs ) {
                    this.idsend(step)
                }
                this.idsend("store all")
                for (let step of dirs ) {
                    this.idsend(this.invert(step))
                }
                this.idsend("dig")
            }, )
        }
        if (/stopdig/.exec(s)) {
            clearInterval(this.digint)
        }

    }
    // give autochop both input line and mud text
    autochop(s) {
        if (this.hardcount != undefined) {
            this.hardcount += 1
        }
        if (/autochop/.exec(s)) {
            //initiate a mover or chopper with state tracking
            this.autochopstate = "moving"
            // start tracking
            this.checkDir("ftrack")
            this.chopint = setInterval(() => {
                this.idsend("l")
                this.idsend("i")
                if (this.autochopstate != "chopping" && this.autochopstate != "backtracking") {
                    this.idsend("chop")
                }
            }, 5000)
        }
        if (/hard\!/.exec(s)) {
            this.hardcount = 0
        }
        if (this.hardcount > 150) {
            // assume that we are in the wrong state, as in chopping but actually stopped
            this.autochopstate = "stopped"
        }
        if (/chop\.\.\./.exec(s)) {
            this.autochopstate = "chopping"
        }
        if (/crack/.exec(s)) {
            this.autochopstate = "stopped"
            this.idsend("stop")
        }
        if (/(\d*)\/25 items/.exec(s)) {
            let amt = parseInt(/(\d*)\/25 items/.exec(s)[1])
            if (amt > 20) {
                // trigger the backtrack
                // set 
                this.autochopstate = "backtracking"
                this.checkDir("backtrack")
            }
        }
        // if you wind up at the lumberyard, 
        if (/A Lumber Yard/.exec(s)) {
            this.idsend("store all.tree")
            this.checkDir("ftrack")
        }
        if (/can't really chop/.exec(s) && this.autochopstate != "backtracking") {
            // wrong place, rand dir now
            let dir = this.randDir()
            this.checkDir(dir)
            this.idsend(dir)
        }
        // forces input up to surface that can trigger either moves, backtracks or
        if (/stopchop/.exec(s)) {
            clearInterval(this.chopint)
        }


    }
    checkDir(s) {
        // setup tracking or not
        if (/ftrack/.exec(s)) {
            this.track = true
        }
        if (this.track) {

        }
        if (/backtrack/.exec(s)) {
            // create a timer and a removal event that pops directions from the stack to return 
            let int = setInterval(() => {
                if (this.travel.length == 0) {
                    clearInterval(int)
                    this.track = false
                }
                this.ws.send(`${this.telnetID}--${this.travel.pop()}`)
            }, 2000)

        }
    }
    invert() {
        switch (s) {
            case "n":
                return "s"
                break
            case "s":
                return "n"
                break
            case "e":
                return "w"
                break
            case "w":
                return "e"
                break
        }
    }

    sendInput(e) {
        console.log(e.key)
        if (e.key == "Enter") {
            // check for combat elements
            // target is the input line at the bottom we should say 
            this.combat.parseCommand(e.target.value)
            // dir check
            this.checkDir(e.target.value)
            this.autochop(e.target.value)
            this.autodig(e.target.value)
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
        this.autochop(t)
        let autoResponse = this.combat.search(t)
        this.exit.search(t)
        if (autoResponse) {
            this.ws.send(`${this.telnetID}--${autoResponse}`)
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
            let selectOpt = options.slice(dirInd, dirInd + 1)
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