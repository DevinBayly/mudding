#!/usr/bin/env python
import asyncio
import websockets
import telnetlib
import threading
import re

host = "localhost"
port = "4000"
tn = telnetlib.Telnet(host, port)


class TelSock:
    def __init__(self, tn):
        self.tn = tn

    async def echo(self, websocket, path):
        self.ws = websocket
        threading.Thread(target=self.start_read_eventloop).start()
        async for message in websocket:
            print(message)
            self.tn.write("{}\n".format(message).encode())

    def start_read_eventloop(self):
        # this is the function we target with the thread because its not async, but will make the asyncio happen in the other thread
        asyncio.run(self.read_loop())

    async def read_loop(self):
        print("in readloop")
        print(self.ws)
        while True:
            contents = tn.read_until(b"\n", .5).decode("utf-8")
            if not contents == "":
                ansi_escape = re.compile(r'''
                    \x1B    # ESC
                    [@-_]   # 7-bit C1 Fe
                    [0-?]*  # Parameter bytes
                    [ -/]*  # Intermediate bytes
                    [@-~]   # Final byte
                ''', re.VERBOSE)
                result = ansi_escape.sub('', contents)
                print(result)
                await self.ws.send(result)


ts = TelSock(tn)

asyncio.get_event_loop().run_until_complete(
    websockets.serve(ts.echo, 'localhost', 8765))


asyncio.get_event_loop().run_forever()
