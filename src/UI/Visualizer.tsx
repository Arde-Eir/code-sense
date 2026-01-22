import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, Node, Edge, useNodesState, useEdgesState } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css'; 

// MAKE SURE THIS MATCHES YOUR FILE NAME (CFGBuilder.ts)
import { buildCFG } from '../analysis/CFG'; 

// --- 1. Layout Logic (Sugiyama Algorithm) ---
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: 150, height: 50 });
    });
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    // @ts-ignore
    const layoutedNodes = nodes.map((node: any) => {
        const nodeWithPos = dagreGraph.node(node.id);
        return {
            ...node,
            position: { x: nodeWithPos.x, y: nodeWithPos.y },
            targetPosition: 'top',
            sourcePosition: 'bottom',
        };
    });

    return { nodes: layoutedNodes, edges };
};

export const Visualizer = ({ ast, onNodeHover }: { ast: any, onNodeHover?: (loc: any) => void }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    
    // CHANGED: Instead of x/y coordinates, we just store the text string
    const [explanation, setExplanation] = useState<string | null>(null);

    useEffect(() => {
        if(!ast) return;

        try {
            const rawCFG = buildCFG(ast); 
            
            const rfNodes: Node[] = rawCFG.nodes.map((n: any) => ({ 
                 id: n.id, 
                 data: { 
                     label: n.label, 
                     description: n.description,
                     location: n.location 
                 }, 
                 position: { x: 0, y: 0 },
                 // Default Style
                 style: { background: '#333', color: '#fff', border: '1px solid #777' }
            }));
            
            const rfEdges: Edge[] = rawCFG.edges.map((e: any) => ({
                id: `e-${e.source}-${e.target}`,
                source: e.source,
                target: e.target,
                label: e.label,
                animated: true 
            }));
            
            // @ts-ignore
            const layout = getLayoutedElements(rfNodes, rfEdges);
            setNodes(layout.nodes);
            setEdges(layout.edges);

        } catch (error) {
            console.error("Visualizer Crash:", error);
        }
    }, [ast]);

    // --- Hover Handlers (Redesigned) ---
    const onNodeMouseEnter = useCallback((event: React.MouseEvent, node: Node) => {
        // 1. Set the explanation text (for the bottom bar)
        setExplanation(node.data.description || node.data.label);

        // 2. Trigger the Editor Highlight (The Bi-Directional Magic)
        if (onNodeHover && node.data.location) {
            onNodeHover(node.data.location);
        }
        
        // 3. (Optional) Highlight the specific node border so you know which one is active
        setNodes((nds) => nds.map((n) => {
            if (n.id === node.id) {
                return { ...n, style: { ...n.style, border: '2px solid #4ec9b0', background: '#222' } };
            }
            return n;
        }));

    }, [onNodeHover, setNodes]);

    const onNodeMouseLeave = useCallback(() => {
        setExplanation(null); // Hide the bottom bar

        // Reset node styles back to normal
        setNodes((nds) => nds.map((n) => ({
            ...n, 
            style: { background: '#333', color: '#fff', border: '1px solid #777' }
        })));
    }, [setNodes]);

    return (
        <div style={{ height: 500, border: '1px solid #444', position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
            <ReactFlow 
                nodes={nodes} 
                edges={edges} 
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseLeave={onNodeMouseLeave}
                fitView
            >
                <Background color="#555" gap={16} />
                <Controls />
            </ReactFlow>

            {/* --- NEW FIXED INFO PANEL (Bottom) --- */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(37, 37, 38, 0.98)', // Opaque dark background
                borderTop: '2px solid #4ec9b0',       // Accent line
                padding: '15px',
                color: '#fff',
                minHeight: '50px',
                transition: 'transform 0.2s ease-in-out',
                // Slide up if there is text, slide down (hide) if null
                transform: explanation ? 'translateY(0)' : 'translateY(100%)', 
                boxShadow: '0 -4px 15px rgba(0,0,0,0.5)',
                zIndex: 10
            }}>
                <div style={{ 
                    fontWeight: 'bold', 
                    color: '#4ec9b0', 
                    marginBottom: '5px', 
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    Explanation Module
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.5', fontFamily: 'Segoe UI, sans-serif' }}>
                    {explanation || "..."}
                </div>
            </div>
        </div>
    );
};