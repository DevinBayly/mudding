#!/usr/bin/env python
import asyncio
import websockets
import telnetlib
import threading
import re

# so we actually have to store a list of telnets, and when we start, let the first message be an identifying message sent to the client, that it must preface all other ones with
# connection is made, echo is called message is "handshake", tn is created, and pushed into stack, and readloop threadstarted ws responds to the client with a ID number that must go in front of other messages,then that index is used to find the correct tn session and comm with it
# must add supprt to decipher which client should respond to the message in the onmessage part


class TelSock:
    def __init__(self):
        self.host = "localhost"
        self.port = "4000"
        self.thread_up = False
        self.tns = []

   async def echo(self, websocket, path):
        self.ws = websocket
        # sending ws to tn

        async for message in websocket:
            if "register" in message[:len("register")]:
                # initialize the tn
                temp_tn = telnetlib.Telnet(self.host,self.port)
                self.tns.append(temp_tn)
                if not self.thread_up:
                    threading.Thread(target=self.start_read_eventloop).start()
                    self.thread_up = True
                # write back the id
                await self.ws.send("id"+len(self.tns))
            print(message)
            self.tn.write("{}\n".format(message).encode())

    def start_read_eventloop(self):
        # this is the function we target with the thread because its not async, but will make the asyncio happen in the other thread
        asyncio.run(self.read_loop())

    async def read_loop(self):
        print("in readloop")
        print(self.ws)
        # sending tn to ws
        while True:
            ## go over the tns we have to listen on
            if self.thread_up:
            for tn in self.tns:
                contents = tn.read_until(b"\n", .2).decode("utf-8")
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
