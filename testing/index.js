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
    ob.selected =[]
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
    ob.pprint =() => {
        for (let x =0; x < dim;x++ ) {
            console.log(ob.array.slice(x*dim,(x+1)*dim))
        }
        console.log("end print")
    }
    ob.approveMove= (b) => {
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

let maze
window.onload = () => {
    maze = Maze(5)
    let i = 0
    while (maze.done == false){
        console.log(maze.x,maze.y)
        maze.step()
        // test hesitation for move, dependent on whether we actually did go somewhere
        maze.approveMove(Math.random() > .4)
        maze.pprint()
        console.log(i)
        i++
    }
}