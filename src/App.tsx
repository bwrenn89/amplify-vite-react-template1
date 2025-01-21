import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

function App() {
  const { user, signOut } = useAuthenticator();
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);
  const [organizations, setOrganizations] = useState<Array<Schema["Organization"]["type"]>>([]);
  const [selectedOrg, setSelectedOrg] = useState<Schema["Organization"]["type"] | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingTodos, setLoadingTodos] = useState(false);

  useEffect(() => {
    if (!user) {
      console.error("User is not authenticated");
      return;
    }
    console.log("Authenticated user:", user);
    console.log("Client object:", client);

    if (!client.models || !client.models.Organization) {
      console.error("Organization model is not defined");
      return;
    }

    // Fetch user's organizations
    const subscription = client.models.Organization.observeQuery().subscribe({
      next: (data) => {
        setOrganizations([...data.items]);
        setLoadingOrgs(false);
      },
      error: (err) => {
        console.error("Error fetching organizations:", err);
        setLoadingOrgs(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [user]);

  useEffect(() => {
    if (selectedOrg) {
      setLoadingTodos(true);

      if (!client.models || !client.models.Todo) {
        console.error("Todo model is not defined");
        return;
      }

      // Fetch todos for selected organization
      const subscription = client.models.Todo.observeQuery({
        filter: {
          organizationId: { eq: selectedOrg.id }
        }
      }).subscribe({
        next: (data) => {
          setTodos([...data.items]);
          setLoadingTodos(false);
        },
        error: (err) => {
          console.error("Error fetching todos:", err);
          setLoadingTodos(false);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [selectedOrg]);

  async function createOrganization() {
    try {
      if (!client.models || !client.models.Organization) {
        console.error("Organization model is not defined");
        return;
      }

      const name = window.prompt("Organization name");
      if (name) {
        const org = await client.models.Organization.create({
          name,
          description: "New organization"
        });

        if (!client.models || !client.models.User) {
          console.error("User model is not defined");
          return;
        }
        
        // Add current user to organization
        await client.models.User.create({
          email: user?.signInDetails?.loginId,
          organizations: [org]
        });
      }
    } catch (err) {
      console.error("Error creating organization:", err);
    }
  }

  async function addUserToOrganization() {
    try {
      if (!selectedOrg) {
        alert("Please select an organization first");
        return;
      }
      const email = window.prompt("User email");
      if (email) {
        const userToAdd = await client.models.User.create({
          email,
          organizations: [selectedOrg]
        });
        console.log("User added to organization:", userToAdd);
      }
    } catch (err) {
      console.error("Error adding user to organization:", err);
    }
  }

  async function createTodo() {
    try {
      if (!selectedOrg) {
        alert("Please select an organization first");
        return;
      }
      const content = window.prompt("Todo content");
      if (content) {
        await client.models.Todo.create({
          content,
          organizationId: selectedOrg.id,
          assignedToId: user?.userId
        });
      }
    } catch (err) {
      console.error("Error creating todo:", err);
    }
  }
    
  async function deleteTodo(id: string) {
    try {
      await client.models.Todo.delete({ id });
    } catch (err) {
      console.error("Error deleting todo:", err);
    }
  }

  if (!user) {
    return <p>Loading...</p>;
  }

  return (
    <main>
      <h1>{user?.signInDetails?.loginId}'s Dashboard</h1>
      
      <div>
        <h2>Organizations</h2>
        <button onClick={createOrganization}>Create Organization</button>
        <button onClick={addUserToOrganization}>Add User to Organization</button>
        {loadingOrgs ? (
          <p>Loading organizations...</p>
        ) : (
          <select 
            value={selectedOrg?.id || ''} 
            onChange={(e) => {
              const org = organizations.find(o => o.id === e.target.value);
              setSelectedOrg(org || null);
            }}
          >
            <option value="">Select an organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        )}
      </div>

      {selectedOrg && (
        <div>
          <h2>Todos for {selectedOrg.name}</h2>
          <button onClick={createTodo}>+ New Todo</button>
          {loadingTodos ? (
            <p>Loading todos...</p>
          ) : (
            <ul>
              {todos.map((todo) => (
                <li 
                  onClick={() => deleteTodo(todo.id)}
                  key={todo.id}
                >
                  {todo.content}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      <button onClick={signOut}>Sign out</button>
    </main>
  );
}

export default App;
