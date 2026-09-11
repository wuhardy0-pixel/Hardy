using System;
using UnityEngine;
using Unity.Netcode;
using Unity.Netcode.Transports.UTP;
using Unity.Networking.Transport.Relay;
using Unity.Services.Core;
using Unity.Services.Authentication;
using Unity.Services.Relay;

public class FunnyFolkNetwork : MonoBehaviour
{
    public static bool ShowLobby;
    static string lanAddress="127.0.0.1", joinCode="", status="Choose LAN or Relay multiplayer.";
    static bool busy;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (FindObjectOfType<NetworkManager>()) return;
        var go=new GameObject("Funny Folk Network");
        var transport=go.AddComponent<UnityTransport>();
        var manager=go.AddComponent<NetworkManager>();
        manager.NetworkConfig.NetworkTransport=transport;
        go.AddComponent<FunnyFolkNetwork>();
        DontDestroyOnLoad(go);
    }

    public static void DrawLobby(Rect area, GUIStyle label, GUIStyle button)
    {
        GUI.Box(area,"");
#if UNITY_WEBGL
        GUI.Label(new Rect(area.x+18,area.y+15,area.width-36,95),"WEB MULTIPLAYER UPGRADE REQUIRED\nThis Unity 2021 build cannot host or join through WebGL. Open this project in Unity 2022.3+ with Transport 2.x to enable secure WebSocket Relay rooms.",label);
        GUI.Label(new Rect(area.x+18,area.y+120,area.width-36,90),"Native Mac/Windows builds can already use LAN and Relay room codes.",label);
#else
        GUI.Label(new Rect(area.x+18,area.y+12,area.width-36,28),"LAN — same Wi-Fi network",label);
        lanAddress=GUI.TextField(new Rect(area.x+20,area.y+45,area.width-40,36),lanAddress);
        if(GUI.Button(new Rect(area.x+20,area.y+88,area.width/2-25,45),"HOST LAN",button))StartLanHost();
        if(GUI.Button(new Rect(area.x+area.width/2+5,area.y+88,area.width/2-25,45),"JOIN LAN",button))StartLanClient();
        GUI.Label(new Rect(area.x+18,area.y+145,area.width-36,28),"ONLINE RELAY — share a room code",label);
        joinCode=GUI.TextField(new Rect(area.x+20,area.y+178,area.width-40,36),joinCode.ToUpperInvariant());
        GUI.enabled=!busy;
        if(GUI.Button(new Rect(area.x+20,area.y+221,area.width/2-25,45),"CREATE ROOM",button))CreateRelayHost();
        if(GUI.Button(new Rect(area.x+area.width/2+5,area.y+221,area.width/2-25,45),"JOIN CODE",button))JoinRelayRoom();
        GUI.enabled=true;
        string net=NetworkManager.Singleton.IsHost?"HOST CONNECTED":NetworkManager.Singleton.IsClient?"CLIENT CONNECTED":"OFFLINE";
        GUI.Label(new Rect(area.x+18,area.y+278,area.width-36,75),net+"\n"+status,label);
#endif
    }

    static UnityTransport Transport(){return NetworkManager.Singleton.GetComponent<UnityTransport>();}
    static void Shutdown(){if(NetworkManager.Singleton.IsListening)NetworkManager.Singleton.Shutdown();}
    static void StartLanHost(){Shutdown();Transport().SetConnectionData("127.0.0.1",7777,"0.0.0.0");status=NetworkManager.Singleton.StartHost()?"LAN host started on port 7777.":"LAN host failed.";}
    static void StartLanClient(){Shutdown();Transport().SetConnectionData(string.IsNullOrWhiteSpace(lanAddress)?"127.0.0.1":lanAddress.Trim(),7777);status=NetworkManager.Singleton.StartClient()?"Connecting to "+lanAddress+":7777...":"LAN join failed.";}

    static async void CreateRelayHost()
    {
        if(busy)return;busy=true;status="Signing in and creating room...";
        try{
            await EnsureServices();
            var allocation=await RelayService.Instance.CreateAllocationAsync(3);
            joinCode=await RelayService.Instance.GetJoinCodeAsync(allocation.AllocationId);
            Shutdown();Transport().SetRelayServerData(new RelayServerData(allocation,"dtls"));
            status=NetworkManager.Singleton.StartHost()?"ROOM CODE: "+joinCode+" — share it with friends.":"Relay host failed.";
        }catch(Exception e){status="Relay error: "+e.Message;}finally{busy=false;}
    }

    static async void JoinRelayRoom()
    {
        if(busy||string.IsNullOrWhiteSpace(joinCode))return;busy=true;status="Joining room "+joinCode+"...";
        try{
            await EnsureServices();
            var allocation=await RelayService.Instance.JoinAllocationAsync(joinCode.Trim().ToUpperInvariant());
            Shutdown();Transport().SetRelayServerData(new RelayServerData(allocation,"dtls"));
            status=NetworkManager.Singleton.StartClient()?"Connected through Relay.":"Relay join failed.";
        }catch(Exception e){status="Relay error: "+e.Message;}finally{busy=false;}
    }

    static async System.Threading.Tasks.Task EnsureServices()
    {
        if(UnityServices.State!=ServicesInitializationState.Initialized)await UnityServices.InitializeAsync();
        if(!AuthenticationService.Instance.IsSignedIn)await AuthenticationService.Instance.SignInAnonymouslyAsync();
    }
}
