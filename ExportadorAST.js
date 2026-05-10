/* ============================================
   CODEFLOW - EXPORTADOR AST (Módulo)
   - Genera una representación JSON limpia (Tokens)
   - Prepara el terreno para la futura transpilación a Python
============================================ */

(function(){
    window.ASTExporter = {
      generateJSON: function() {
          // Verificamos que el núcleo del programa esté cargado
          if (typeof ASTManager === 'undefined' || !ASTManager.root) {
              return JSON.stringify({ error: "ASTManager no está disponible" }, null, 4);
          }
  
          // Función recursiva para limpiar el árbol
          // Quitamos el 'parentId' y limpiamos nodos vacíos para que el JSON sea más legible
          const cleanAST = (nodes) => {
              if (!nodes || !Array.isArray(nodes)) return [];
              
              return nodes.map(n => {
                  const cleanNode = {
                      id: n.id,
                      type: n.type,
                      data: n.data
                  };
                  
                  // Si tiene hijos (como los IF, WHILE, FOR o DEF), los procesamos
                  if (n.children !== null && n.children !== undefined) {
                      cleanNode.children = cleanAST(n.children);
                  }
                  
                  return cleanNode;
              });
          };
          
          // Generamos el árbol a partir de los hijos de 'root'
          const tokenTree = cleanAST(ASTManager.root.children);
          
          // Lo convertimos a texto JSON con una indentación de 4 espacios
          return JSON.stringify(tokenTree, null, 4);
      }
    };
    
    console.log("Módulo Exportador de AST (JSON) cargado correctamente.");
})();