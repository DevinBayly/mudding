import asyncio
import telnetlib

async def talk_telnet():
    tn = telnetlib.Telnet("localhost",4000)
    while True:
        contents =tn.read_very_eager()
        if contents != b"":
            print(contents)
        await asyncio.sleep(1)
        text = input("text: ")
        tn.write(text.encode() +b"\n")

asyncio.run(talk_telnet())


class mazer(object):
    def __init__(self, width, height):
        # make widthxheight spots
        self.positions = ['_' for i in range(width*height)]
        # start in the middle
        self.x = width//2
        self.y = height//2
        self.options = []
        self.backtrac = []
        self.i = 0

    def xyind(self, x, y):
        ind = width*y + x
        if ind >= self.positions:
            return -1
        return ind

    def check(self, x, y):
        ind = self.xind(x, y)
        if ind == -1:
            False
        return self.positions[ind] == "_"

    def run(self):
        # start
        while self.step() != false:
            # provide for blocked exits
            pass

    def get_exits():
        # want -1,0 and +1,0 or 0,-1 0,+1
        res = []
        for i in range(2):
            part = [0, 0]
            for h in range(2):
                part[i] = h*2 - 1
                res.append(part)
        return res

    def rand(i):
        return (i**7 + i**6 + 1) % 4

    def step(self, exits):
        # get possible exits
        exits = [self.xyind(self.x + pair[0], self, y+pair[1])
                 for pair in self.get_exits()]
        print(exits)
        # randomly select one
        self.i+=1
        choice = rand(self.i)

        # push the others onto the options stack
        return False
