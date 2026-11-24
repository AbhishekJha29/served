import { auth, currentUser } from "@clerk/nextjs/server";

const STRAPI_URL =
  process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    console.log("No User found");
    return null;
  }

  if (!STRAPI_API_TOKEN) {
    console.error("❌ STRAPI_API_TOKEN is missing in environment variables");
    return { error: "CMS_UNAVAILABLE" };
  }

  // Check if user has Pro plan
  const { has } = await auth();
  const subscriptionTier = has({ plan: "pro" }) ? "pro" : "free";

  try {
    // Check if user exists in Strapi
    const userUrl = `${STRAPI_URL}/api/users?filters[clerkId][$eq]=${user.id}`;
    let existingUserResponse;
    try {
      existingUserResponse = await fetch(userUrl, {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      });
    } catch (fetchErr) {
      console.error(`❌ Strapi fetch error on /api/users:`, fetchErr.message);
      return { error: "CMS_UNAVAILABLE" };
    }

    const existingContentType = existingUserResponse.headers.get("content-type");
    if (!existingUserResponse.ok || !existingContentType?.includes("application/json")) {
      console.error(
        `❌ Strapi GET /api/users failed: ${existingUserResponse.status}`,
        await existingUserResponse.text()
      );
      return { error: "CMS_UNAVAILABLE" };
    }

    const existingUserData = await existingUserResponse.json();

    if (Array.isArray(existingUserData) && existingUserData.length > 0) {
      const existingUser = existingUserData[0];

      // Update subscription tier if changed
      if (existingUser.subscriptionTier !== subscriptionTier) {
        try {
          const updateResponse = await fetch(
            `${STRAPI_URL}/api/users/${existingUser.id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${STRAPI_API_TOKEN}`,
              },
              body: JSON.stringify({ subscriptionTier }),
            }
          );

          if (!updateResponse.ok) {
            console.error(
              `❌ Strapi error: status ${updateResponse.status} on /api/users/${existingUser.id}`
            );
          }
        } catch (updateErr) {
          console.error(
            `❌ Error updating subscription tier on /api/users/${existingUser.id}:`,
            updateErr.message
          );
        }
      }

      return { ...existingUser, subscriptionTier };
    }

    // Get authenticated role
    let rolesResponse;
    try {
      rolesResponse = await fetch(
        `${STRAPI_URL}/api/users-permissions/roles`,
        {
          headers: {
            Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          },
        }
      );
    } catch (rolesErr) {
      console.error(
        `❌ Strapi fetch error on /api/users-permissions/roles:`,
        rolesErr.message
      );
      return { error: "CMS_UNAVAILABLE" };
    }

    const rolesContentType = rolesResponse.headers.get("content-type");
    if (!rolesResponse.ok || !rolesContentType?.includes("application/json")) {
      console.error(
        `❌ Strapi error: status ${rolesResponse.status} on /api/users-permissions/roles`
      );
      return { error: "CMS_UNAVAILABLE" };
    }

    const rolesData = await rolesResponse.json();
    const authenticatedRole = rolesData?.roles?.find(
      (role) => role.type === "authenticated"
    );

    if (!authenticatedRole) {
      console.error("❌ Authenticated role not found in Strapi");
      return { error: "CMS_UNAVAILABLE" };
    }

    // Create new user
    const userData = {
      username:
        user.username || user.emailAddresses[0].emailAddress.split("@")[0],
      email: user.emailAddresses[0].emailAddress,
      password: `clerk_managed_${user.id}_${Date.now()}`,
      confirmed: true,
      blocked: false,
      role: authenticatedRole.id,
      clerkId: user.id,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      imageUrl: user.imageUrl || "",
      subscriptionTier,
    };

    let newUserResponse;
    try {
      newUserResponse = await fetch(`${STRAPI_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        body: JSON.stringify(userData),
      });
    } catch (newUserErr) {
      console.error(
        `❌ Strapi fetch error on /api/users (POST):`,
        newUserErr.message
      );
      return { error: "CMS_UNAVAILABLE" };
    }

    const newUserContentType = newUserResponse.headers.get("content-type");
    if (!newUserResponse.ok || !newUserContentType?.includes("application/json")) {
      console.error(
        `❌ Strapi POST /api/users failed: ${newUserResponse.status}`,
        await newUserResponse.text()
      );
      return { error: "CMS_UNAVAILABLE" };
    }

    const newUser = await newUserResponse.json();
    return newUser;
  } catch (error) {
    console.error("❌ Error in checkUser connecting to Strapi:", error.message);
    return { error: "CMS_UNAVAILABLE" };
  }
};