import bcrypt from "bcryptjs";
import { PrismaClient, Priority, Role, Status } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ticketflow.dev" },
    update: { name: "Admin Demo", role: Role.ADMIN, passwordHash },
    create: {
      name: "Admin Demo",
      email: "admin@ticketflow.dev",
      role: Role.ADMIN,
      passwordHash,
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@ticketflow.dev" },
    update: { name: "Agent Demo", role: Role.AGENT, passwordHash },
    create: {
      name: "Agent Demo",
      email: "agent@ticketflow.dev",
      role: Role.AGENT,
      passwordHash,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@ticketflow.dev" },
    update: { name: "Employee Demo", role: Role.EMPLOYEE, passwordHash },
    create: {
      name: "Employee Demo",
      email: "employee@ticketflow.dev",
      role: Role.EMPLOYEE,
      passwordHash,
    },
  });

  await prisma.comment.deleteMany({
    where: {
      ticket: {
        title: { startsWith: "[SEED]" },
      },
    },
  });

  await prisma.ticket.deleteMany({
    where: {
      title: { startsWith: "[SEED]" },
    },
  });

  const ticketData = [
    {
      title: "[SEED] Login form broken on Safari",
      description: "Users report login button does not submit on Safari 17.",
      status: Status.OPEN,
      priority: Priority.HIGH,
      createdById: employee.id,
      assignedToId: agent.id,
    },
    {
      title: "[SEED] Missing translated labels in profile",
      description: "Spanish labels are missing on account settings page.",
      status: Status.IN_PROGRESS,
      priority: Priority.MEDIUM,
      createdById: employee.id,
      assignedToId: agent.id,
    },
    {
      title: "[SEED] Slow dashboard load for admins",
      description: "Dashboard takes about 8 seconds after login for admin role.",
      status: Status.OPEN,
      priority: Priority.HIGH,
      createdById: admin.id,
      assignedToId: agent.id,
    },
    {
      title: "[SEED] Add dark mode preference",
      description: "Feature request to persist user dark mode preference.",
      status: Status.CLOSED,
      priority: Priority.LOW,
      createdById: employee.id,
      assignedToId: null,
    },
    {
      title: "[SEED] Export tickets to CSV",
      description: "Operations team needs CSV export for weekly reporting.",
      status: Status.IN_PROGRESS,
      priority: Priority.MEDIUM,
      createdById: admin.id,
      assignedToId: agent.id,
    },
    {
      title: "[SEED] Mobile layout overlap in ticket detail",
      description: "Status badge overlaps title on small screens.",
      status: Status.OPEN,
      priority: Priority.MEDIUM,
      createdById: employee.id,
      assignedToId: agent.id,
    },
  ];

  const createdTickets = [] as Array<{ id: number }>;

  for (const ticket of ticketData) {
    const created = await prisma.ticket.create({ data: ticket, select: { id: true } });
    createdTickets.push(created);
  }

  await prisma.comment.createMany({
    data: [
      {
        content: "I can reproduce this issue locally. Investigating root cause.",
        ticketId: createdTickets[0].id,
        authorId: agent.id,
      },
      {
        content: "Temporary workaround: use Chrome until fix is deployed.",
        ticketId: createdTickets[0].id,
        authorId: admin.id,
      },
      {
        content: "Copy updates were added to the backlog for this sprint.",
        ticketId: createdTickets[1].id,
        authorId: admin.id,
      },
      {
        content: "Profiling query timings now; suspect N+1 in list view.",
        ticketId: createdTickets[2].id,
        authorId: agent.id,
      },
      {
        content: "CSV columns confirmed with operations team.",
        ticketId: createdTickets[4].id,
        authorId: employee.id,
      },
    ],
  });

  console.log("Seed completed.");
  console.log("Demo users:");
  console.log("- admin@ticketflow.dev / 123456");
  console.log("- agent@ticketflow.dev / 123456");
  console.log("- employee@ticketflow.dev / 123456");
  console.log("Created tickets:", createdTickets.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
