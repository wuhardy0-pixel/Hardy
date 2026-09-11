#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

[InitializeOnLoad]
public static class ProjectBootstrap
{
    static ProjectBootstrap()
    {
        EditorApplication.delayCall += EnsureScene;
    }

    static void EnsureScene()
    {
        const string folder="Assets/Scenes", path="Assets/Scenes/Main.unity";
        if(!AssetDatabase.IsValidFolder(folder)) AssetDatabase.CreateFolder("Assets","Scenes");
        if(!System.IO.File.Exists(path))
        {
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            EditorSceneManager.SaveScene(scene,path);
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(path,true)};
        }
    }
}
#endif
