using System;
using System.Collections.Generic;
using UnityEngine;

public class FunnyFolkGame : MonoBehaviour
{
    enum Mode { Title, Starter, Explore, Battle, BattleMoves, Bag, Shop, Team, Equipment }
    enum FolkType { Snack, Homework, Internet, Poop, Ad, Plunger }

    [Serializable] class Move
    {
        public string name, joke;
        public int power, cost;
        public FolkType type;
        public Action<Fighter, Fighter> extra;
    }

    [Serializable] class Fighter
    {
        public string name;
        public string portrait;
        public FolkType type;
        public int level = 1, hp, maxHp, energy = 5, attack, defense, speed, xp, evolutionStage;
        public string equipment = "Nothing";
        public int equipAttack, equipDefense;
        public string status = "Healthy";
        public int statusTurns;
        public string ability;
        public List<Move> moves = new List<Move>();
        public Fighter Clone() { return (Fighter)MemberwiseClone(); }
    }

    Mode mode = Mode.Title;
    readonly List<Fighter> party = new List<Fighter>();
    readonly List<Fighter> collection = new List<Fighter>();
    readonly List<string> equipment = new List<string>{"Cardboard Helmet","Grandma's Slipper","Wi-Fi Cape"};
    Fighter active, enemy;
    Vector2 player = new Vector2(7, 7);
    int coins = 300, snackBalls = 5, treats = 3, wins;
    bool teamBattle;
    readonly List<string> badges = new List<string>();
    readonly HashSet<string> metPeople = new HashSet<string>();
    string message = "Welcome to Funny Folk Online!";
    GUIStyle title, label, button;
    Texture2D pixel;
    Texture2D playerAvatar;
    Texture2D[] funnyPeople;
    System.Random random = new System.Random();

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (!FindObjectOfType<FunnyFolkGame>()) new GameObject("Funny Folk Game").AddComponent<FunnyFolkGame>();
    }

    void Awake()
    {
        pixel = new Texture2D(1, 1); pixel.SetPixel(0, 0, Color.white); pixel.Apply();
        funnyPeople = Resources.LoadAll<Texture2D>("FunnyPeople");
        playerAvatar = Resources.Load<Texture2D>("player_commander");
    }

    void Update()
    {
        if ((mode == Mode.Team || mode == Mode.Equipment) && Input.GetKeyDown(KeyCode.Escape)) { mode=Mode.Explore; return; }
        if (mode != Mode.Explore) return;
        Vector2 old = player;
        if (Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.UpArrow)) player.y++;
        if (Input.GetKeyDown(KeyCode.S) || Input.GetKeyDown(KeyCode.DownArrow)) player.y--;
        if (Input.GetKeyDown(KeyCode.A) || Input.GetKeyDown(KeyCode.LeftArrow)) player.x--;
        if (Input.GetKeyDown(KeyCode.D) || Input.GetKeyDown(KeyCode.RightArrow)) player.x++;
        player.x = Mathf.Clamp(player.x, 1, 18); player.y = Mathf.Clamp(player.y, 1, 12);
        if (IsBlocked(player)) player=old;
        if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter)) Interact();
        if (Input.GetKeyDown(KeyCode.Tab)) mode=Mode.Team;
        if (old != player && IsGrass(player) && random.NextDouble() < .18) StartWildBattle();
    }

    void Styles()
    {
        if (title != null) return;
        title = new GUIStyle(GUI.skin.label) { fontSize = 30, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
        title.normal.textColor = new Color(1, .82f, .18f);
        label = new GUIStyle(GUI.skin.label) { fontSize = 16, wordWrap = true }; label.normal.textColor = Color.white;
        button = new GUIStyle(GUI.skin.button) { fontSize = 16, fontStyle = FontStyle.Bold };
    }

    void OnGUI()
    {
        Styles(); GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), pixel, ScaleMode.StretchToFill, false, 0, new Color(.025f, .04f, .1f), 0, 0);
        if (mode == Mode.Title) DrawTitle(); else if (mode == Mode.Starter) DrawStarter(); else if (mode == Mode.Explore) DrawWorld(); else if(mode==Mode.Battle || mode==Mode.BattleMoves || mode==Mode.Bag) DrawBattle(); else if(mode==Mode.Shop) DrawShop(); else if(mode==Mode.Equipment) DrawEquipment(); else DrawTeam();
    }

    void DrawTitle()
    {
        GUI.Label(new Rect(Screen.width/2-330, 70, 660, 70), "FUNNY FOLK ONLINE", title);
        GUI.Label(new Rect(Screen.width/2-280, 150, 560, 90), "Collect ridiculous people, teach them tactical joke moves, explore towns, and battle friends.", label);
        if (GUI.Button(new Rect(Screen.width/2-220, 270, 210, 58), "SOLO ADVENTURE", button)) mode = Mode.Starter;
        if (GUI.Button(new Rect(Screen.width/2+10, 270, 210, 58), "MULTIPLAYER", button)) FunnyFolkNetwork.ShowLobby = true;
        if (FunnyFolkNetwork.ShowLobby) FunnyFolkNetwork.DrawLobby(new Rect(Screen.width/2-270, 345, 540, 365), label, button);
    }

    void DrawStarter()
    {
        GUI.Label(new Rect(Screen.width/2-300, 40, 600, 60), "CHOOSE YOUR FIRST FUNNY PERSON", title);
        string[] names = { "Emotional Support Potato", "Leaf-Blower Dad", "Lag Goblin" };
        for (int i=0;i<3;i++)
        {
            float x=Screen.width/2-330+i*225; GUI.Box(new Rect(x,130,205,280), "");
            GUI.Label(new Rect(x+15,145,175,55), names[i], label);
            string portrait=i==0?"support_potato":i==1?"leaf_blower_dad":"lag_goblin";
            GUI.DrawTexture(new Rect(x+48,200,110,110),Resources.Load<Texture2D>("FunnyPeople/"+portrait),ScaleMode.ScaleToFit);
            GUI.Label(new Rect(x+15,305,175,35), i==0?"Snack • Healer":i==1?"Homework • Pusher":"Internet • Energy thief", label);
            if (GUI.Button(new Rect(x+18,335,169,48), "PICK ME", button)) { AddStarter(i); mode=Mode.Explore; }
        }
    }

    void DrawWorld()
    {
        float cell=Mathf.Min(Screen.width/20f,(Screen.height-150)/14f), ox=(Screen.width-cell*20)/2, oy=55;
        for(int y=0;y<14;y++) for(int x=0;x<20;x++)
        {
            Vector2 p=new Vector2(x,y);string biome=Biome(p);Color grass=BiomeColor(biome);Color c=(x==0||y==0||x==19||y==13||IsBlocked(p))?new Color(.06f,.25f,.11f):(IsGrass(p)?grass:new Color(.72f,.58f,.35f));
            GUI.DrawTexture(new Rect(ox+x*cell,oy+(13-y)*cell,cell-1,cell-1),pixel,ScaleMode.StretchToFill,false,0,c,0,0);
        }
        DrawMarker(ox,oy,cell,3,10,"PC",new Color(.2f,.45f,1)); DrawMarker(ox,oy,cell,6,10,"MART",new Color(.1f,.8f,.45f)); DrawMarker(ox,oy,cell,15,9,"RIVAL",new Color(.9f,.25f,.25f)); DrawMarker(ox,oy,cell,11,3,"BOSS",new Color(.65f,.25f,.8f));
        GUI.Label(new Rect(ox+14*cell,oy+(13-5)*cell,5*cell,22),"POOP LAND",label);GUI.Label(new Rect(ox+10*cell,oy+(13-11)*cell,4*cell,22),"AD ALLEY",label);GUI.Label(new Rect(ox+14*cell,oy+(13-11)*cell,4*cell,22),"HOMEWORK HILLS",new GUIStyle(label){fontSize=11});GUI.Label(new Rect(ox+2*cell,oy+(13-4)*cell,4*cell,22),"PLUNGER MARSH",new GUIStyle(label){fontSize=11});GUI.Label(new Rect(ox+6*cell,oy+(13-4)*cell,4*cell,22),"SNACK SPRINGS",new GUIStyle(label){fontSize=11});GUI.Label(new Rect(ox+10*cell,oy+(13-5)*cell,4*cell,22),"INTERNET WOODS",new GUIStyle(label){fontSize=11});
        DrawMarker(ox,oy,cell,5,8,"GRANDMA",new Color(.95f,.55f,.7f));DrawMarker(ox,oy,cell,8,5,"CHEF",new Color(1,.75f,.2f));DrawMarker(ox,oy,cell,12,6,"ROUTER",new Color(.2f,.75f,1));DrawMarker(ox,oy,cell,16,7,"COACH",new Color(.85f,.85f,.25f));DrawMarker(ox,oy,cell,2,5,"PETE",new Color(.25f,.8f,.85f));DrawMarker(ox,oy,cell,17,6,"MAYOR",new Color(.55f,.35f,.12f));
        GUI.DrawTexture(new Rect(ox+player.x*cell-8,oy+(13-player.y)*cell-18,cell+16,cell+16),playerAvatar?playerAvatar:Portrait(active),ScaleMode.ScaleToFit);
        GUI.Box(new Rect(10,10,455,125),""); GUI.Label(new Rect(20,16,435,112),"Giggle Town  •  Coins "+coins+"  •  Balls "+snackBalls+"  •  Treats "+treats+"  •  Wins "+wins+"\nBadges: "+(badges.Count==0?"None yet":string.Join(", ",badges))+"\nPartner: "+active.name+"  HP "+active.hp+"/"+active.maxHp+"  Lv."+active.level+"  Form "+(active.evolutionStage+1)+"\nWASD/Arrows move • SPACE/ENTER interact • TAB team\nTan path = safe • Green patches = possible encounters",label);
        GUI.Box(new Rect(10,Screen.height-70,Screen.width-20,60),""); GUI.Label(new Rect(25,Screen.height-62,Screen.width-50,44),message,label);
    }

    void DrawBattle()
    {
        GUI.Label(new Rect(0,25,Screen.width,55),teamBattle?"SQUAD BATTLE — YOUR TEAM WILL ASSIST":"RIDICULOUS BATTLE",title);
        GUI.Box(new Rect(45,100,Screen.width/2-70,190),""); GUI.Box(new Rect(Screen.width/2+25,100,Screen.width/2-70,190),"");
        GUI.Label(new Rect(65,112,Screen.width/2-110,165),active.name+"  Lv."+active.level+"\nHP "+active.hp+"/"+active.maxHp+"  Energy "+active.energy+"\n"+TypeName(active.type)+" • "+TypeHint(active.type)+"\nStatus: "+active.status+"\nAbility: "+active.ability,label);
        GUI.Label(new Rect(Screen.width/2+45,112,Screen.width/2-110,165),enemy.name+"  Lv."+enemy.level+"\nHP "+enemy.hp+"/"+enemy.maxHp+"  Energy "+enemy.energy+"\n"+TypeName(enemy.type)+" • "+TypeHint(enemy.type)+"\nStatus: "+enemy.status+"\nAbility: "+enemy.ability,label);
        GUI.DrawTexture(new Rect(75,190,170,125),Portrait(active),ScaleMode.ScaleToFit);
        GUI.DrawTexture(new Rect(Screen.width-245,190,170,125),Portrait(enemy),ScaleMode.ScaleToFit);
        if(mode==Mode.Battle){
            if(GUI.Button(new Rect(70,345,Screen.width/2-100,70),"ATTACK",button))mode=Mode.BattleMoves;
            if(GUI.Button(new Rect(Screen.width/2+30,345,Screen.width/2-100,70),"BAG",button))mode=Mode.Bag;
            if(GUI.Button(new Rect(70,430,Screen.width-140,58),"RUN",button)){mode=Mode.Explore;message="You escaped using the ancient technique of leaving.";}
        } else if(mode==Mode.BattleMoves){
            for(int i=0;i<active.moves.Count;i++){Move m=active.moves[i];float x=60+(i%2)*(Screen.width/2-30),y=330+(i/2)*72;if(GUI.Button(new Rect(x,y,Screen.width/2-90,58),m.name+" ["+m.cost+"E]\n"+m.joke,button))UseMove(m);}
            if(GUI.Button(new Rect(Screen.width/2-80,485,160,42),"BACK",button))mode=Mode.Battle;
        } else {
            if(GUI.Button(new Rect(70,345,Screen.width/2-100,62),"SNACK BALL ("+snackBalls+")\nTry to recruit",button))TryRecruit();
            if(GUI.Button(new Rect(Screen.width/2+30,345,Screen.width/2-100,62),"EMERGENCY JUICE\nHeal 25 HP",button)){active.hp=Mathf.Min(active.maxHp,active.hp+25);message="Emergency Juice tastes like orange homework.";EnemyTurn();mode=Mode.Battle;}
            if(GUI.Button(new Rect(70,425,Screen.width/2-100,52),"LEVEL TREAT ("+treats+")",button))UseTreat(true);
            if(GUI.Button(new Rect(Screen.width/2+30,425,Screen.width/2-100,52),"EQUIPMENT: "+active.equipment,button))mode=Mode.Equipment;
            if(GUI.Button(new Rect(Screen.width/2-80,490,160,42),"BACK",button))mode=Mode.Battle;
        }
        GUI.Label(new Rect(40,555,Screen.width-80,70),message,label);
    }

    void DrawMarker(float ox,float oy,float cell,int x,int y,string text,Color c){GUI.DrawTexture(new Rect(ox+x*cell,oy+(13-y)*cell,cell-1,cell-1),pixel,ScaleMode.StretchToFill,false,0,c,0,0);GUI.Label(new Rect(ox+x*cell-8,oy+(13-y)*cell+5,cell+16,25),text,new GUIStyle(label){fontSize=10,alignment=TextAnchor.MiddleCenter});}
    bool IsGrass(Vector2 p){return Biome(p)!="Giggle Path";}
    string Biome(Vector2 p){int x=(int)p.x,y=(int)p.y;if(x>=14&&x<=18&&y>=1&&y<=5)return "Poop Land";if(x>=10&&x<=13&&y>=8&&y<=11)return "Ad Alley";if(x>=14&&x<=17&&y>=8&&y<=11)return "Homework Hills";if(x>=2&&x<=5&&y>=1&&y<=4)return "Plunger Marsh";if(x>=6&&x<=9&&y>=1&&y<=4)return "Snack Springs";if(x>=10&&x<=13&&y>=1&&y<=5)return "Internet Woods";return "Giggle Path";}
    Color BiomeColor(string biome){if(biome=="Poop Land")return new Color(.38f,.24f,.08f);if(biome=="Ad Alley")return new Color(.55f,.2f,.65f);if(biome=="Homework Hills")return new Color(.72f,.68f,.18f);if(biome=="Plunger Marsh")return new Color(.1f,.45f,.48f);if(biome=="Snack Springs")return new Color(.9f,.45f,.28f);if(biome=="Internet Woods")return new Color(.12f,.35f,.75f);return new Color(.12f,.48f,.16f);}
    bool IsBlocked(Vector2 p){int x=(int)p.x,y=(int)p.y;return (x==9&&y>5&&y<12)||(y==6&&x>2&&x<7)||(x==13&&y>1&&y<6);}
    bool Near(int x,int y){return Mathf.Abs(player.x-x)+Mathf.Abs(player.y-y)<=1;}
    void Interact(){
        if(Near(3,10)){foreach(Fighter f in party)f.hp=f.maxHp;message="The PC healed everyone, sorted 900 screenshots, and judged your desktop.";return;}
        if(Near(6,10)){mode=Mode.Shop;return;}
        if(Near(15,9)){enemy=CreateFighter("Rival Kevin's Suspicious Chicken",FolkType.Ad);enemy.portrait="suspicious_chicken";enemy.level=active.level+1;enemy.maxHp+=25;enemy.hp=enemy.maxHp;teamBattle=true;BeginBattle("Rival Kevin challenges your whole squad! His Ad-type chicken keeps interrupting the battle.");return;}
        if(Near(11,3)){enemy=CreateFighter("Royal Poop Golem",FolkType.Poop);enemy.portrait="royal_poop_golem";enemy.level=active.level+3;enemy.maxHp+=60;enemy.hp=enemy.maxHp;teamBattle=true;BeginBattle("SQUAD BOSS! Your collected monsters will assist against the Royal Poop Golem!");return;}
        if(Near(5,8)){MeetOrBattle("Angry Grandma","Wear a sweater. Also take this Treat before I call your mother.",FolkType.Ad,"angry_grandma");return;}
        if(Near(8,5)){MeetOrBattle("Nugget Chef","The secret ingredient is that there was only one nugget left.",FolkType.Snack,"last_nugget");return;}
        if(Near(12,6)){MeetOrBattle("Router Ranger","Internet Woods has excellent signal unless somebody stands in front of me.",FolkType.Internet,"wifi_router");return;}
        if(Near(16,7)){MeetOrBattle("Homework Coach","Homework types pressure Internet monsters. Due date: immediately.",FolkType.Homework,"homework_avalanche");return;}
        if(Near(2,5)){MeetOrBattle("Plunger Pete","Plunger beats Poop. I trained twelve years to say that.",FolkType.Plunger,"emergency_toilet_trap");return;}
        if(Near(17,6)){MeetOrBattle("Mayor Number Two","Welcome to Poop Land. Please wipe your shoes after leaving.",FolkType.Poop,"skibidi_stink_summoner");return;}
        message="There is nothing here, but you interacted with it extremely well.";
    }
    void DrawShop(){GUI.Label(new Rect(0,45,Screen.width,55),"THE QUESTIONABLE MART",title);GUI.Box(new Rect(Screen.width/2-280,120,560,390),"");GUI.Label(new Rect(Screen.width/2-245,140,490,65),"Coins: "+coins+"\nEverything is fresh-ish and definitely fell off no truck.",label);if(GUI.Button(new Rect(Screen.width/2-220,220,440,52),"Snack Ball — 60 coins",button)&&coins>=60){coins-=60;snackBalls++;message="Purchased one Snack Ball. It smells like cheese.";}if(GUI.Button(new Rect(Screen.width/2-220,285,440,52),"Level Treat — 45 coins",button)&&coins>=45){coins-=45;treats++;message="Purchased a Level Treat. The wrapper says probably edible.";}if(GUI.Button(new Rect(Screen.width/2-220,350,440,52),"Heal party — 35 coins",button)&&coins>=35){coins-=35;foreach(Fighter f in party)f.hp=f.maxHp;message="Your party was healed with a motivational juice box.";}if(GUI.Button(new Rect(Screen.width/2-100,430,200,45),"LEAVE",button))mode=Mode.Explore;}
    void DrawTeam(){GUI.Label(new Rect(0,30,Screen.width,55),"YOUR FUNNY MONSTERS",title);for(int i=0;i<party.Count;i++){Fighter f=party[i];float y=105+i*88;GUI.Box(new Rect(Screen.width/2-380,y,760,78),"");GUI.DrawTexture(new Rect(Screen.width/2-370,y+7,62,62),Portrait(f),ScaleMode.ScaleToFit);GUI.Label(new Rect(Screen.width/2-295,y+7,400,65),f.name+"  Lv."+f.level+"  "+f.type+"\nAbility: "+f.ability+" • Equipped: "+f.equipment+"\nHP "+f.hp+"/"+f.maxHp,label);if(GUI.Button(new Rect(Screen.width/2+120,y+15,105,48),f==active?"ACTIVE":"CHOOSE",button)){active=f;message=f.name+" is now leading the comedy expedition.";}if(GUI.Button(new Rect(Screen.width/2+235,y+15,105,48),"EQUIP",button)){active=f;mode=Mode.Equipment;}}if(GUI.Button(new Rect(Screen.width/2-100,Screen.height-65,200,45),"BACK",button))mode=Mode.Explore;}
    void DrawEquipment(){GUI.Label(new Rect(0,35,Screen.width,55),"EQUIPMENT CLOSET",title);GUI.Label(new Rect(Screen.width/2-300,95,600,55),"Equipping: "+active.name+" • Current: "+active.equipment,label);for(int i=0;i<equipment.Count;i++){string item=equipment[i];string bonus=item=="Cardboard Helmet"?"+5 Defense":item=="Grandma's Slipper"?"+7 Attack":"+3 Attack, +3 Defense";if(GUI.Button(new Rect(Screen.width/2-260,165+i*75,520,58),item+" — "+bonus,button))Equip(item);}if(GUI.Button(new Rect(Screen.width/2-100,420,200,48),"BACK TO TEAM",button))mode=Mode.Team;}
    void Equip(string item){active.equipment=item;active.equipAttack=item=="Golden Plunger"?10:item=="Grandma's Slipper"?7:item=="Wi-Fi Cape"?3:0;active.equipDefense=item=="Cardboard Helmet"?5:item=="Wi-Fi Cape"?3:0;message=active.name+" equipped "+item+". Fashion experts have left the server.";}
    void UseTreat(bool inBattle){if(treats<=0){message="No Level Treats left. Only crumbs and emotional damage.";return;}treats--;active.xp+=30;message=active.name+" ate a Level Treat and gained 30 XP!";CheckLevelAndEvolution(active);if(inBattle){EnemyTurn();mode=Mode.Battle;}}
    void CheckLevelAndEvolution(Fighter f){while(f.xp>=f.level*50){f.xp-=f.level*50;f.level++;f.maxHp+=10;f.hp=f.maxHp;f.attack+=3;f.defense+=2;message+=" LEVEL UP!";}if(f.level>=5&&f.evolutionStage==0)Evolve(f);else if(f.level>=10&&f.evolutionStage==1)Evolve(f);}
    void Evolve(Fighter f){f.evolutionStage++;f.name=(f.evolutionStage==1?"Mega ":"Ultra ")+f.name;f.maxHp+=20;f.hp=f.maxHp;f.attack+=5;f.defense+=5;f.moves.Add(new Move{name=f.type+" Evolution Blast",joke="Evolution has no indoor voice.",power=32+f.evolutionStage*5,cost=3,type=f.type});message+=" EVOLUTION! "+f.name+" reached Form "+(f.evolutionStage+1)+"!";}

    void AddStarter(int index)
    {
        Fighter f=index==0?CreateFighter("Emotional Support Potato",FolkType.Snack):index==1?CreateFighter("Leaf-Blower Dad",FolkType.Homework):CreateFighter("Lag Goblin",FolkType.Internet);
        f.portrait=index==0?"support_potato":index==1?"leaf_blower_dad":"lag_goblin";
        party.Add(f); collection.Add(f); active=f; message=f.name+" joined because nobody else answered the group chat.";
    }

    Fighter CreateFighter(string name,FolkType type)
    {
        string portrait=funnyPeople!=null&&funnyPeople.Length>0?funnyPeople[random.Next(funnyPeople.Length)].name:"support_potato";
        Fighter f=new Fighter{name=name,type=type,portrait=portrait,maxHp=70+random.Next(0,25),attack=12+random.Next(0,6),defense=8+random.Next(0,6),speed=8+random.Next(0,7),ability=AbilityFor(type)};f.hp=f.maxHp;
        f.moves.AddRange(MovesFor(type)); return f;
    }

    List<Move> MovesFor(FolkType type)
    {
        var list=new List<Move>();
        list.Add(new Move{name="Wi-Fi Headbutt",joke="Buffering... BONK! Paralyze!",power=15,cost=1,type=FolkType.Internet,extra=(a,b)=>ApplyStatus(b,"Paralyzed",2)});
        list.Add(new Move{name="Homework Beam",joke="Due yesterday. Now everybody is dizzy.",power=11,cost=1,type=FolkType.Homework,extra=(a,b)=>{b.energy=Mathf.Max(0,b.energy-2);ApplyStatus(b,"Dizzy",2);}});
        list.Add(new Move{name="Spicy Emergency Snack",joke="Heals you. Burns them. Nutrition!",power=5,cost=2,type=FolkType.Snack,extra=(a,b)=>{a.hp=Mathf.Min(a.maxHp,a.hp+22);ApplyStatus(b,"Burned",3);}});
        string special=type==FolkType.Poop?"Stink Cloud":type==FolkType.Ad?"Unskippable Flash":type==FolkType.Plunger?"Plunger Spin":type==FolkType.Snack?"Mystery Fridge":type==FolkType.Homework?"Pop Quiz Fog":"Blue Screen Blast";
        string effect=type==FolkType.Poop||type==FolkType.Snack?"Stinky":type==FolkType.Ad||type==FolkType.Homework?"Blind":type==FolkType.Plunger?"Dizzy":"Paralyzed";
        list.Add(new Move{name=special,joke="Inflicts "+effect+". Very professional.",power=25,cost=3,type=type,extra=(a,b)=>ApplyStatus(b,effect,3)});
        return list;
    }

    void StartWildBattle()
    {
        string biome=Biome(player);FolkType favored=biome=="Poop Land"?FolkType.Poop:biome=="Ad Alley"?FolkType.Ad:biome=="Homework Hills"?FolkType.Homework:biome=="Plunger Marsh"?FolkType.Plunger:biome=="Snack Springs"?FolkType.Snack:biome=="Internet Woods"?FolkType.Internet:(FolkType)random.Next(0,6);FolkType t=random.NextDouble()<.7?favored:(FolkType)random.Next(0,6);Texture2D chosen=funnyPeople[random.Next(funnyPeople.Length)];enemy=CreateFighter(Pretty(chosen.name),t);enemy.portrait=chosen.name;enemy.level=Mathf.Max(1,active.level+random.Next(-1,2));teamBattle=false;BeginBattle("A wild "+enemy.name+" appeared in "+biome+"! It is "+TypeName(t)+".");
    }

    void UseMove(Move move)
    {
        if(active.energy<move.cost){message="Not enough Energy. Your fighter checked the couch cushions.";return;}
        if(!CanAct(active)){EnemyTurn();mode=Mode.Battle;return;}if(Dodged(enemy)){message=enemy.name+" used Lag Dodge! The attack is still loading.";EnemyTurn();mode=Mode.Battle;return;}
        active.energy-=move.cost;int targetDefense=enemy.defense+(enemy.status=="Stinky"?-4:0);int damage=Mathf.Max(1,move.power+active.attack+active.equipAttack-targetDefense);if(active.status=="Blind")damage=Mathf.Max(1,(int)(damage*.6f));if(active.ability=="Clean Sweep"&&enemy.status!="Healthy")damage=(int)(damage*1.25f);bool strong=IsStrong(move.type,enemy.type);if(strong)damage=(int)(damage*1.5f);bool critical=random.NextDouble()<.12;if(critical)damage=(int)(damage*1.5f);enemy.hp-=damage;move.extra?.Invoke(active,enemy);message=active.name+" used "+move.name+" for "+damage+" damage! "+(critical?"CRITICAL COMEDY! ":"")+(strong?"SUPER EFFECTIVE! ":"")+move.joke;if(teamBattle)TeamAssist();if(active.ability=="Comfort Aura"){active.hp=Mathf.Min(active.maxHp,active.hp+5);message+=" Comfort Aura healed 5 HP.";}TickStatus(active);
        if(enemy.hp<=0){WinBattle();return;}EnemyTurn();
    }

    void EnemyTurn()
    {
        if(!CanAct(enemy)){TickStatus(enemy);active.energy=Mathf.Min(5,active.energy+1);return;}if(Dodged(active)){message+=" "+active.name+" used Lag Dodge!";return;}Move move=enemy.moves[random.Next(enemy.moves.Count)];int targetDefense=active.defense+active.equipDefense+(active.status=="Stinky"?-4:0);int damage=Mathf.Max(1,move.power+enemy.attack-targetDefense);if(enemy.status=="Blind")damage=Mathf.Max(1,(int)(damage*.6f));if(enemy.ability=="Clean Sweep"&&active.status!="Healthy")damage=(int)(damage*1.25f);active.hp-=damage;move.extra?.Invoke(enemy,active);enemy.energy=Mathf.Min(5,enemy.energy+1);active.energy=Mathf.Min(5,active.energy+1);message+="  "+enemy.name+" replied with "+move.name+" for "+damage+"!";if(enemy.ability=="Comfort Aura")enemy.hp=Mathf.Min(enemy.maxHp,enemy.hp+5);TickStatus(enemy);if(active.hp<=0){active.hp=active.maxHp;active.status="Healthy";active.statusTurns=0;coins=Mathf.Max(0,coins-30);mode=Mode.Explore;message="You woke up at the Snack Center. Someone charged a 30-coin inconvenience fee.";}
    }

    static void ApplyStatus(Fighter f,string status,int turns){f.status=status;f.statusTurns=turns;}
    bool CanAct(Fighter f){if(f.status=="Paralyzed"&&random.NextDouble()<.45){message=f.name+" is paralyzed and cannot move!";TickStatus(f);return false;}if(f.status=="Dizzy"&&random.NextDouble()<.35){int bump=Mathf.Max(2,f.maxHp/12);f.hp-=bump;message=f.name+" got dizzy, walked into itself, and took "+bump+" damage!";TickStatus(f);return false;}return true;}
    void TickStatus(Fighter f){if(f.status=="Burned"){int burn=Mathf.Max(3,f.maxHp/12);f.hp-=burn;message+=" "+f.name+" took "+burn+" burn damage!";}if(f.statusTurns>0)f.statusTurns--;if(f.statusTurns<=0){f.status="Healthy";f.statusTurns=0;}}
    string AbilityFor(FolkType t){if(t==FolkType.Snack)return "Comfort Aura";if(t==FolkType.Homework)return "Deadline Pressure";if(t==FolkType.Internet)return "Lag Dodge";if(t==FolkType.Poop)return "Toxic Entrance";if(t==FolkType.Ad)return "Pop-Up Ambush";return "Clean Sweep";}
    bool Dodged(Fighter f){return f.ability=="Lag Dodge"&&random.NextDouble()<.2;}
    void BeginBattle(string intro){active.status="Healthy";active.statusTurns=0;enemy.status="Healthy";enemy.statusTurns=0;if(active.ability=="Deadline Pressure")enemy.energy=Mathf.Max(0,enemy.energy-1);if(enemy.ability=="Deadline Pressure")active.energy=Mathf.Max(0,active.energy-1);if(active.ability=="Toxic Entrance")ApplyStatus(enemy,"Stinky",2);if(enemy.ability=="Toxic Entrance")ApplyStatus(active,"Stinky",2);if(active.ability=="Pop-Up Ambush")ApplyStatus(enemy,"Blind",2);if(enemy.ability=="Pop-Up Ambush")ApplyStatus(active,"Blind",2);mode=Mode.Battle;message=intro;}
    void TeamAssist(){int total=0,count=0;foreach(Fighter ally in party){if(ally==active||ally.hp<=0)continue;int hit=Mathf.Max(2,(ally.attack+ally.equipAttack)/4);if(IsStrong(ally.type,enemy.type))hit=(int)(hit*1.5f);total+=hit;count++;if(count==2)break;}if(total>0){enemy.hp-=total;message+=" Your squad jumped in for "+total+" assist damage!";}}
    void MeetOrBattle(string person,string words,FolkType type,string portrait){if(metPeople.Add(person)){treats++;message=person+": “"+words+"” You received a Level Treat! Talk again to challenge this Land Guardian.";return;}enemy=CreateFighter(person+"'s "+type+" Guardian",type);enemy.portrait=portrait;enemy.level=active.level+2;enemy.maxHp+=35;enemy.hp=enemy.maxHp;teamBattle=true;BeginBattle(person+" starts a Land Guardian squad battle! Win to earn the "+type+" Badge.");}

    void TryRecruit()
    {
        if(snackBalls<=0){message="No Snack Balls left.";return;}snackBalls--;float chance=.25f+.55f*(1f-(float)enemy.hp/enemy.maxHp);if(random.NextDouble()<chance){collection.Add(enemy);party.Add(enemy);coins+=20;mode=Mode.Explore;message=enemy.name+" joined your party after seeing the dental plan!";}else{message="It escaped because the snack was the wrong flavor.";EnemyTurn();}
    }

    void WinBattle(){wins++;int reward=enemy.name.Contains("Guardian")?75:40;coins+=reward;treats++;active.xp+=25;active.energy=5;string award=" You found a Level Treat!";if(enemy.name.Contains("Guardian")){string badge=enemy.type+" Badge";if(!badges.Contains(badge)){badges.Add(badge);award+=" NEW "+badge+"!";}}if(enemy.name.Contains("Rival")&&!badges.Contains("Chicken Badge")){badges.Add("Chicken Badge");award+=" You earned the Chicken Badge!";}if(enemy.name.Contains("Poop Golem")&&!badges.Contains("Golden Plunger Badge")){badges.Add("Golden Plunger Badge");equipment.Add("Golden Plunger");award+=" You earned the Golden Plunger Badge and equipment!";}message="Victory! +"+reward+" coins."+award;CheckLevelAndEvolution(active);mode=Mode.Explore;}
    bool IsStrong(FolkType a,FolkType b){return (a==FolkType.Snack&&b==FolkType.Homework)||(a==FolkType.Homework&&b==FolkType.Internet)||(a==FolkType.Internet&&b==FolkType.Snack)||(a==FolkType.Poop&&b==FolkType.Ad)||(a==FolkType.Ad&&b==FolkType.Plunger)||(a==FolkType.Plunger&&b==FolkType.Poop);}
    string TypeName(FolkType t){return t+" type";}
    string TypeHint(FolkType t){if(t==FolkType.Poop)return "Strong vs Ad • Weak vs Plunger";if(t==FolkType.Ad)return "Strong vs Plunger • Weak vs Poop";if(t==FolkType.Plunger)return "Strong vs Poop • Weak vs Ad";if(t==FolkType.Snack)return "Strong vs Homework • Weak vs Internet";if(t==FolkType.Homework)return "Strong vs Internet • Weak vs Snack";return "Strong vs Snack • Weak vs Homework";}
    Texture2D Portrait(Fighter f){return f==null?pixel:Resources.Load<Texture2D>("FunnyPeople/"+f.portrait);}
    string Pretty(string id){string[] words=id.Replace("_"," ").Split(' ');for(int i=0;i<words.Length;i++)if(words[i].Length>0)words[i]=char.ToUpper(words[i][0])+words[i].Substring(1);return string.Join(" ",words);}
}
