import asyncio
import re
import websockets
import telnetlib
import subprocess as sp
import os

print("starting ws")
## start up the client  page

class Trimmed:
    def __init__(self):
        self.pairs = {}

    async def echo(self, websocket, path):
        # need a list of the websockets
        # sending ws to tn
        async for message in websocket:
            if message == "register":
                task = asyncio.create_task(self.connection(websocket))
            print("got ", message)
            # get the tn
            if self.pairs.get(websocket, -1) != -1:
                bytes_message = "{}\n".format(message.strip()).encode()
                self.pairs[websocket].write(bytes_message)

    async def connection(self, ws):
        tn = telnetlib.Telnet("theforestsedge.com", 4000)
        # create an entry for the telnet
        self.pairs[ws] = tn
        while True:
            try:
                contents = tn.read_very_eager()
                if contents != b"":
                    ansi_escape = re.compile(r'''
                        \x1B    # ESC
                        [@-_]   # 7-bit C1 Fe
                        [0-?]*  # Parameter bytes
                        [ -/]*  # Intermediate bytes
                        [@-~]   # Final byte
                    ''', re.VERBOSE)
                    result = ansi_escape.sub('', contents.decode())
                    print(result)
                    await ws.send(result)
                await asyncio.sleep(.5)
            except EOFError:
                tn = telnetlib.Telnet("localhost", 4000)
                self.pairs[ws] = tn

t = Trimmed()
asyncio.get_event_loop().run_until_complete(
    websockets.serve(t.echo, "0.0.0.0", 8765))
asyncio.get_event_loop().run_forever()
