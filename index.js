// could have a multi class now
// with a timed char creation and random name and attribute selelction process
let Maze = (dim) => {
    // have a place to start
    let ob = {}
    ob.dim = dim
    ob.array = Array(dim * dim).fill(0)
    ob.done = false
    ob.x = 0
    ob.y = 0
    ob.step_type = ""
    ob.array[0] = 1
    ob.selected = []
    ob.path = []
    ob.ind = (x, y) => {
        return y * ob.dim + x
    }
    ob.check = (x, y) => {
        if (x < 0 || y < 0) {
            return false
        }
        if (x >= dim || y >= dim) {
            return false
        }
        if (ob.array[ob.ind(x, y)] == 1) {
            return false
        }
        return true
    }
    ob.step = () => {
        let opts = []
        let chosen
        let x = ob.x
        let y = ob.y
        for (let shift of [-1, 1]) {
            if (ob.check(x + shift, y)) {
                opts.push([shift, 0])
            }
            if (ob.check(x, y + shift)) {
                opts.push([0, shift])
            }
        }
        // handle if opts is still 0 length
        if (opts.length == 0) {
            if (ob.path.length == 0) {
                ob.done = true
                return
            }
            chosen = ob.path.pop()[0]
            chosen = [-chosen[0], -chosen[1]]
            ob.step_type = "backtrack"
        } else {
            let select = Math.floor(Math.random() * opts.length)
            chosen = opts.splice(select, 1)[0]
            ob.path.push([chosen])
            console.log(ob.path)
            ob.step_type = "forward"
        }

        ob.selected[0] = chosen[0]
        ob.selected[1] = chosen[1]

    }
    ob.pprint = () => {
        for (let x = 0; x < dim; x++) {
            console.log(ob.array.slice(x * dim, (x + 1) * dim))
        }
        console.log("end print")
    }
    ob.approveMove = (b) => {
        if (b || ob.step_type == "backtrack") {
            // make the old index into a 1
            let ind = ob.ind(ob.x, ob.y)
            ob.array[ind] = 1
            // new index into a 2
            ob.x += ob.selected[0]
            ob.y += ob.selected[1]
            ind = ob.ind(ob.x, ob.y)
            ob.array[ind] = 2
        } else {
            console.log("not approved")
            // push selected back onto the path stack
        }

    }

    return ob
}

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
            let percentage = (this.ta.scrollTopMax - this.ta.scrollTop) / this.ta.scrollTopMax
            if (percentage > 0) {
                this.stayBottomLocked = false
            } else {
                this.stayBottomLocked = true
            }
        })
    }
    run(move_string) {
        if (/\d+/.exec(move_string)) {
            let matches = move_string.match(/\d+\w/g)
            move_string = ""
            for (let m of matches) {
                //20w for instance
                let num = parseInt(m)
                move_string += m.slice(-1).repeat(num)
            }
        }
        for (let c of move_string) {
            this.idsend(c)
        }
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
    repeat(s) {
        if (/rp (\d+) "(.*)"/.exec(s)) {
            let matches = /rp (\d+) "(.*)"/.exec(s)
            let commands = matches[2].split(";")
            for (let i = 0; i < parseInt(matches[1]); i++) {
                for (let com of commands) {

                    this.idsend(com)
                }
            }
        }
    }
    socketSetup() {
        this.ws = new WebSocket(`ws://${document.querySelector("#wssel").value}`)
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
                this.updateTextArea(`${e.data}`)
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
    idsend(s) {
        this.ws.send(`${s}`)
    }
    autodig(s) {
        if (/autodig.*/.exec(s)) {
            this.digint = setInterval(() => {
                //move south
                let parts = /autodig (.*) (\d+)/.exec(s)
                let dirs = parts[1].split(" ")

                for (let step of dirs) {
                    this.idsend(step)
                }
                this.idsend("store all")
                for (let step of dirs) {
                    this.idsend(this.invert(step))
                }
                this.idsend("dig")
            })
        }
        if (/stopdig/.exec(s)) {
            clearInterval(this.digint)
        }

    }
    bumpChop() {
        if (this.corrector) {
            clearInterval(this.corrector)
        }
        this.corrector = setInterval(() => {
            this.idsend("say nothing left")
        }, 20 * 1000)
    }
    // give autochop both input line and mud text
    autochop(s) {
        if (/chopon/.exec(s)) {
            if (this.chopon) {
                this.chopon = !this.chopon
            } else {
                this.chopon = true
            }

        }
        if (/(\d*)\/25 items/.exec(s)) {
            let amt = parseInt(/(\d*)\/25 items/.exec(s)[1])
            if (amt > 20) {
                // trigger the backtrack
                // set 
                // calc list for LL and goget
                this.checkDir("calclist LL")
                this.checkDir("goget")
            }
        }
        //chop causes commands: chop
        if (/Commands: chop,/.exec(s)) {
            if (this.autochopstate != "chopping")
                this.idsend("gather")
            this.autochopstate = "chopping"
        }
        if (/axe hard!/.exec(s)) {
            this.bumpChop()
        }

        //stop causes nothing here to chop,stop causes need to lead to further steps
        if (/nothing left/.exec(s)) {
            this.autochopstate = "notchopping"
            this.checkDir("calclist \\^")
            this.checkDir("goget")
            this.bumpChop()
        }
        if (/crack/.exec(s)) {
            // if we crack check for inventory
            this.idsend("i")
            this.bumpChop()
        }

        // if you wind up at the lumberyard, 
        if (/A Lumber Yard/.exec(s)) {
            this.idsend("store all")
            this.autochopstate = "notchopping"
            // establish new map from s
            this.storeMap(s)
            this.checkDir("calclist \\^")
            this.checkDir("goget")
            // trigger and clear
            this.bumpChop()
        }


    }
    // a map is 15 units wide 15 tall
    // meaning 7 lines above user on 8th and 7 lines below
    storeMap(s) {
        if (/\+[\s\S]+\+/.exec(s)) {
            this.map = /\+[\s\S]+\+/.exec(s)[0]
        }
    }
    // sotr the lumber list for overall distance, and pop the first, convert to run units. each time this function is run we will recompute, no need to compose a map once and then do it over and over
    calcList(glyph) {
        this.loclist = []
        if (this.map) {
            let lines = this.map.split("\n")
            // drop top and bottom parts
            lines = lines.slice(1, -1)
            for (let y = 0; y < lines.length; y++) {
                //break into parts
                let line = lines[y].slice(1, -2) // remove the | chars on either end of line
                let x = 0
                while (x < line.length - 4) {
                    let tile = line.slice(x, x + 4)
                    console.log(tile)
                    let reg = new RegExp(glyph)
                    if (reg.exec(tile)) {
                        // convert to units and put in lumber list
                        this.loclist.push([x / 4 - 7, y - 7])
                        console.log("element at ", this.loclist[this.loclist.length - 1])
                    }
                    x += 4
                }
            }
        }
    }
    convert_dirs(pair) {
        let x = pair[0]
        let y = pair[1]
        let x_dir, y_dir
        if (x > 0) {
            x_dir = "e".repeat(x)
        } else {
            x_dir = "w".repeat(-x)
        }
        if (y > 0) {
            y_dir = "s".repeat(y)
        } else {
            y_dir = "n".repeat(-y)
        }
        return [x_dir, y_dir]
    }
    checkDir(s) {
        // calculate lumber list, make character for lumber list general 
        if (/goget/.exec(s)) {
            // take the top element of the lumber list, convert to run, then run
            let choice = this.loclist[0]
            console.log(choice, "is choice")
            let dirs = this.convert_dirs(choice)
            console.log(dirs)
            this.run(dirs[0] + dirs[1])



        }
        if (/calclist (.*)/.exec(s)) {
            let glyph = /calclist (.*)/.exec(s)[1]
            this.calcList(glyph)
            // sort the list for 0s first
            this.loclist.sort((f, s) => {
                return (Math.abs(f[0]) + Math.abs(f[1])) > (Math.abs(s[0]) + Math.abs(s[1]))
            })
            console.log(this.loclist)
        }
        // setup tracking or not
        if (/run (.*)/.exec(s)) {
            this.run(/run (.*)/.exec(s)[1])
        }
        if (/ftrack/.exec(s)) {
            this.track = true
        }
        if (this.track) {
            // store entries
            if ("nesw".indexOf(s) != -1) {
                this.travel.push(this.invert(s))
            }
        }
        if (/backtrack/.exec(s)) {
            // create a timer and a removal event that pops directions from the stack to return 
            let int = setInterval(() => {
                if (this.travel.length == 0) {
                    clearInterval(int)
                    this.track = false
                }
                this.ws.send(`${this.travel.pop()}`)
            }, 2000)

        }
    }
    invert(s) {
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
        if (e.key == "Enter") {
            // check for combat elements
            // target is the input line at the bottom we should say 
            this.combat.parseCommand(e.target.value)
            // dir check
            this.repeat(e.target.value)
            this.checkDir(e.target.value)
            this.autochop(e.target.value)
            this.autodig(e.target.value)
            if (this.automove(e.target.value)) {
                console.log("automoving")
            } else {
                this.ws.send(`${e.target.value}`)
            }
            e.target.value = ""
        }
    }
    updateTextArea(t) {
        this.ta.value += t
        if (this.chopon) {
            this.autochop(t)

        }
        this.storeMap(t)
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
    let input = document.createElement("input")
    input.id = "wssel"
    let btn = document.createElement("button")
    btn.addEventListener("click", () => {
        let client = new Client()
    })
    btn.innerHTML="submit"
    document.body.append(input)
    document.body.append(btn)

    // create mazer
    //let maze = Mazer()
    //maze.starting(20, 20)
    //window.addEventListener("keydown", (e) => {
    //    if (e.key == "a") {
    //        maze.step()
    //    }
    //})
}
