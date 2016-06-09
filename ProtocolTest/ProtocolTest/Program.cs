using System;
using Newtonsoft.Json.Linq;
using SuperSocket.ClientEngine;
using WebSocket4Net;
// ReSharper disable UnusedParameter.Local

namespace ProtocolTest
{
    public static class GardenCfg
    {
        public static string TargetHost = "ws://172.17.60.216:23234";
    }

    public class Garden
    {
        private readonly object _lockObject = new object();
        private readonly WebSocket _ws;
        private static Garden _instance;
        private string _recentMessage;
        private bool _disposing;
        private bool _hasError;
        private readonly string _errorMsg = null;

        public string Message
        {
            get
            {
                lock (_lockObject)
                {
                    return _recentMessage;
                }
            }
        }

        public bool IsOpen
        {
            get
            {
                if (_ws == null)
                    return false;
                if (_ws.State == WebSocketState.Open)
                    return true;
                return false;
            }
        }

        public bool HasError
        {
            get
            {
                if (_ws == null)
                    return false;
                return _hasError;
            }
        }

        public string Error
        {
            get
            {
                if (HasError)
                    return _errorMsg;
                return null;
            }
        }

        public static Garden GetInstance()
        {
            if (_instance == null)
                _instance = new Garden();
            return _instance;
        }

        public void Dispose()
        {
            if (_disposing)
                return;
            _disposing = true;
            if (_ws != null)
            {
                _ws.Close();
                _ws.Dispose();
            }
        }

        private Garden()
        {
            if (_ws == null)
                _ws = new WebSocket(GardenCfg.TargetHost);
            _ws.EnableAutoSendPing = true;
            _ws.AutoSendPingInterval = 60;
            _ws.Opened += WsOnOpened;
            _ws.MessageReceived += WsOnMessageReceived;
            _ws.Error += WsOnError;
            _ws.Open();
        }

        public void Refresh()
        {
            JObject o = new JObject();
            o["valve"] = "update";

            _ws.Send(o.ToString());
        }

        private void WsOnError(object sender, ErrorEventArgs ev)
        {
            _hasError = true;
        }

        private void WsOnMessageReceived(object sender, MessageReceivedEventArgs ev)
        {
            lock (_lockObject)
            {
                _recentMessage = ev.Message;
            }
        }

        private void WsOnOpened(object sender, EventArgs ev)
        {
            // ignore
        }
    }


    class Program
    {
        static void Main(string[] args)
        {
            Garden g = Garden.GetInstance();
            for (; ; )
            {
                g.Refresh();
                if (!string.IsNullOrEmpty(g.Message))
                    Console.WriteLine("Message: " + g.Message.Trim());
                System.Threading.Thread.Sleep(1000);
            }
        }
    }
}
