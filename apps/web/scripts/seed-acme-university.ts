// Seeds the working "Acme University" example: the location place row, the
// organization row, its 4 fixed language networks (Spanish, Mandarin
// Chinese, French, Arabic), and - per network - a handful of fake student
// profiles and realistic posts/replies written in that network's target
// language, so the example networks are pre-launched and populated rather
// than empty shells.
//
// Safe to re-run: every step is existence-checked first (by name/slug for
// the place/org, by language+location for each network, by a stable
// username for each fake profile, by author for each network's posts) -
// re-running after the first successful seed is a no-op.
//
// Run via: npm run seed-acme-university

import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not present (e.g. CI) - fall through to whatever's already
  // in the environment.
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type FakeStudent = {
  usernameSuffix: string;
  firstName: string;
  lastName: string;
  aboutMe: string;
};

type LanguageSeed = {
  languageName: string; // exact stored `languages.name`
  code: string; // short code used to namespace usernames/emails
  networkTitleSuffix: string;
  students: FakeStudent[];
  posts: string[]; // one author per post, cycling through `students`
  replies: { postIndex: number; authorIndex: number; body: string }[];
};

const ORG_NAME = "Acme University";
const ORG_SLUG = "acme-university";
const ORG_SUBDOMAIN = "learn";
const ORG_DOMAIN = "acme.edu";
const LOCATION_NAME = "Acme University";
// Acme is purely an example org, so it's fine to anchor it to any real US
// city - Springfield, IL is the placeholder city already used elsewhere in
// the admin/self-serve forms.
const PARENT_CITY_NAME = "Springfield";
const PARENT_REGION_NAME = "Illinois";
const PARENT_COUNTRY_NAME = "United States";

const LANGUAGE_SEEDS: LanguageSeed[] = [
  {
    languageName: "Spanish",
    code: "es",
    networkTitleSuffix: "Spanish speakers at Acme University",
    students: [
      { usernameSuffix: "camila_r", firstName: "Camila", lastName: "Rodríguez", aboutMe: "Estudiante de segundo año, me encanta el cine latinoamericano." },
      { usernameSuffix: "mateo_f", firstName: "Mateo", lastName: "Fernández", aboutMe: "Aquí para practicar español y conocer gente nueva." },
      { usernameSuffix: "valentina_t", firstName: "Valentina", lastName: "Torres", aboutMe: "Extraño mi país pero encantada de estar en Acme." },
      { usernameSuffix: "diego_m", firstName: "Diego", lastName: "Morales", aboutMe: "Estudio ingeniería y hablo español en casa." },
      { usernameSuffix: "sofia_r", firstName: "Sofía", lastName: "Ramírez", aboutMe: "Organizo el club de conversación los jueves." },
      { usernameSuffix: "andres_c", firstName: "Andrés", lastName: "Castillo", aboutMe: "Me apunto a cualquier plan para practicar el idioma." },
      { usernameSuffix: "lucia_g", firstName: "Lucía", lastName: "Gómez", aboutMe: "Amante de la literatura latinoamericana." },
      { usernameSuffix: "javier_o", firstName: "Javier", lastName: "Ortiz", aboutMe: "Nuevo en el campus, buscando amigos que hablen español." },
    ],
    posts: [
      "¡Hola a todos! Soy nueva en Acme University y me encantaría encontrar un grupo de estudio para practicar español los fines de semana. ¿Alguien se anima?",
      "¿Alguien sabe si hay un club de conversación en español que se reúna en el Babbio Center? Extraño hablar español todos los días desde que llegué aquí.",
      "Este sábado organizamos una noche de películas en español en la residencia Reid Hall. ¡Traigan palomitas!",
      "Terminé mi primer examen de literatura latinoamericana. ¡Qué difícil fue analizar a García Márquez en español!",
      "Busco compañero de cuarto que hable español para practicar todos los días. Vivo cerca del campus.",
      "El profesor Ramírez organiza un intercambio de idiomas todos los jueves a las 6pm en la biblioteca. ¡Vengan!",
      "Extraño mucho la comida de mi país, pero encontré un restaurante peruano cerca del campus que me hace sentir en casa.",
      "¿Alguien más se apunta al viaje cultural a la ciudad este fin de semana? Sería genial practicar español fuera del campus.",
    ],
    replies: [
      { postIndex: 0, authorIndex: 4, body: "¡Yo me apunto! Vivo en el mismo dormitorio, hablamos luego." },
      { postIndex: 5, authorIndex: 2, body: "Genial, ahí estaré. Gracias por organizarlo." },
    ],
  },
  {
    languageName: "Mandarin Chinese/Putonghua",
    code: "zh",
    networkTitleSuffix: "Mandarin Chinese speakers at Acme University",
    students: [
      { usernameSuffix: "xiaoyu_w", firstName: "小雨", lastName: "王", aboutMe: "刚入学的新生,喜欢中国电影和文学。" },
      { usernameSuffix: "ming_l", firstName: "明", lastName: "李", aboutMe: "在这里练习中文,认识新朋友。" },
      { usernameSuffix: "wei_z", firstName: "伟", lastName: "张", aboutMe: "工程专业学生,在家说中文。" },
      { usernameSuffix: "jing_c", firstName: "静", lastName: "陈", aboutMe: "想家,但很高兴能在Acme遇到大家。" },
      { usernameSuffix: "yang_l", firstName: "洋", lastName: "刘", aboutMe: "每周四组织语言交流活动。" },
      { usernameSuffix: "min_z", firstName: "敏", lastName: "赵", aboutMe: "任何练习中文的机会我都愿意参加。" },
      { usernameSuffix: "tao_s", firstName: "涛", lastName: "孙", aboutMe: "喜欢中国现代文学。" },
      { usernameSuffix: "ying_z", firstName: "颖", lastName: "周", aboutMe: "新生,想找会说中文的朋友。" },
    ],
    posts: [
      "大家好!我刚来Acme University读书,想找人一起练习中文,周末有没有人有兴趣?",
      "学校图书馆旁边新开了一家奶茶店,大家去尝过了吗?味道还不错。",
      "这周六晚上在Reid Hall有中文电影之夜,欢迎大家一起来看电影聊天。",
      "刚考完中国文学的期中考试,分析鲁迅的文章真的不容易,大家考得怎么样?",
      "有没有人想找中文语伴,每周见面聊聊天,互相帮助学习?",
      "教授星期四晚上六点在图书馆组织语言交流活动,大家都可以去参加。",
      "有点想家,不过在校园附近找到了一家中餐馆,吃到了家乡的味道,很开心。",
      "这个周末学校组织去城里的文化之旅,有人报名了吗?出去走走应该很有意思。",
    ],
    replies: [
      { postIndex: 0, authorIndex: 4, body: "我也是新生!我们住在同一栋宿舍,可以约时间一起练习。" },
      { postIndex: 5, authorIndex: 2, body: "太好了,我一定去,谢谢你组织这个活动。" },
    ],
  },
  {
    languageName: "French",
    code: "fr",
    networkTitleSuffix: "French speakers at Acme University",
    students: [
      { usernameSuffix: "camille_d", firstName: "Camille", lastName: "Dubois", aboutMe: "Nouvelle étudiante, passionnée de cinéma francophone." },
      { usernameSuffix: "louis_m", firstName: "Louis", lastName: "Martin", aboutMe: "Ici pour pratiquer le français et rencontrer du monde." },
      { usernameSuffix: "chloe_b", firstName: "Chloé", lastName: "Bernard", aboutMe: "Mon pays me manque mais je suis ravie d'être à Acme." },
      { usernameSuffix: "hugo_l", firstName: "Hugo", lastName: "Lefebvre", aboutMe: "Étudiant en ingénierie, je parle français à la maison." },
      { usernameSuffix: "manon_g", firstName: "Manon", lastName: "Girard", aboutMe: "J'organise le club de conversation le jeudi." },
      { usernameSuffix: "antoine_r", firstName: "Antoine", lastName: "Rousseau", aboutMe: "Partant pour n'importe quelle occasion de pratiquer." },
      { usernameSuffix: "lea_m", firstName: "Léa", lastName: "Moreau", aboutMe: "Amoureuse de la littérature francophone." },
      { usernameSuffix: "theo_s", firstName: "Théo", lastName: "Simon", aboutMe: "Nouveau sur le campus, je cherche des amis francophones." },
    ],
    posts: [
      "Salut tout le monde! Je viens d'arriver à Acme University et j'aimerais trouver un groupe pour pratiquer le français le week-end. Ça intéresse quelqu'un?",
      "Est-ce que quelqu'un sait s'il y a un club de conversation française qui se réunit au Babbio Center? Le français me manque depuis que je suis ici.",
      "Ce samedi, on organise une soirée cinéma en français à Reid Hall. Apportez du pop-corn!",
      "Je viens de terminer mon examen de littérature francophone. Analyser Camus en français, ce n'était pas facile!",
      "Je cherche un colocataire qui parle français pour pratiquer tous les jours. J'habite près du campus.",
      "Le professeur Girard organise un échange linguistique tous les jeudis à 18h à la bibliothèque. Venez nombreux!",
      "La cuisine de mon pays me manque beaucoup, mais j'ai trouvé un restaurant français près du campus qui me fait sentir chez moi.",
      "Quelqu'un d'autre s'inscrit pour l'excursion culturelle en ville ce week-end? Ce serait super de pratiquer le français hors campus.",
    ],
    replies: [
      { postIndex: 0, authorIndex: 4, body: "Je suis partant! J'habite dans la même résidence, on peut se parler bientôt." },
      { postIndex: 5, authorIndex: 2, body: "Génial, j'y serai. Merci d'avoir organisé ça." },
    ],
  },
  {
    languageName: "Arabic",
    code: "ar",
    networkTitleSuffix: "Arabic speakers at Acme University",
    students: [
      { usernameSuffix: "layla_a", firstName: "ليلى", lastName: "أحمد", aboutMe: "طالبة جديدة، أحب الأدب العربي." },
      { usernameSuffix: "omar_k", firstName: "عمر", lastName: "خالد", aboutMe: "هنا لأتدرب على اللغة العربية وأتعرف على أصدقاء جدد." },
      { usernameSuffix: "nour_h", firstName: "نور", lastName: "حسن", aboutMe: "أشتاق لبلدي لكنني سعيدة بوجودي في أكمي." },
      { usernameSuffix: "youssef_i", firstName: "يوسف", lastName: "إبراهيم", aboutMe: "طالب هندسة، أتحدث العربية في المنزل." },
      { usernameSuffix: "sara_m", firstName: "سارة", lastName: "محمود", aboutMe: "أنظم نادي المحادثة كل خميس." },
      { usernameSuffix: "ahmed_s", firstName: "أحمد", lastName: "سعيد", aboutMe: "مستعد لأي فرصة لممارسة اللغة." },
      { usernameSuffix: "mona_t", firstName: "منى", lastName: "طارق", aboutMe: "أحب الأدب العربي الحديث." },
      { usernameSuffix: "karim_f", firstName: "كريم", lastName: "فؤاد", aboutMe: "جديد في الحرم الجامعي، أبحث عن أصدقاء يتحدثون العربية." },
    ],
    posts: [
      "مرحبا بالجميع! أنا طالب جديد في جامعة أكمي وأرغب في إيجاد مجموعة لممارسة اللغة العربية في عطلة نهاية الأسبوع. من يهتم؟",
      "هل يعرف أحد إذا كان هناك نادي محادثة باللغة العربية يجتمع في مركز بابيو؟ اشتقت للتحدث بالعربية كل يوم منذ وصولي هنا.",
      "هذا السبت سننظم أمسية أفلام عربية في قاعة ريد هول. أحضروا الفشار معكم!",
      "أنهيت للتو اختبار الأدب العربي الحديث. تحليل نصوص نجيب محفوظ لم يكن سهلا أبدا!",
      "أبحث عن زميل سكن يتحدث العربية لأتدرب معه كل يوم. أسكن قرب الحرم الجامعي.",
      "تنظم الأستاذة نور تبادلا لغويا كل يوم خميس الساعة السادسة مساء في المكتبة. تعالوا بكثرة!",
      "أشتاق كثيرا لطعام بلدي، لكنني وجدت مطعما عربيا قرب الحرم الجامعي يجعلني أشعر وكأنني في بيتي.",
      "هل سجل أحد آخر في الرحلة الثقافية إلى المدينة هذا الأسبوع؟ سيكون رائعا أن نتدرب على العربية خارج الحرم الجامعي.",
    ],
    replies: [
      { postIndex: 0, authorIndex: 4, body: "أنا معك! أسكن في نفس السكن، يمكننا التحدث لاحقا." },
      { postIndex: 5, authorIndex: 2, body: "رائع، سأكون هناك. شكرا لتنظيم هذا." },
    ],
  },
];

async function ensurePlace(): Promise<number> {
  const { data: existing } = await admin
    .from("places")
    .select("id")
    .eq("name", LOCATION_NAME)
    .eq("type", "campus")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: country } = await admin
    .from("places")
    .select("id")
    .eq("type", "country")
    .eq("name", PARENT_COUNTRY_NAME)
    .single();
  const { data: region } = await admin
    .from("places")
    .select("id")
    .eq("type", "region")
    .eq("name", PARENT_REGION_NAME)
    .eq("parent_id", country!.id)
    .single();
  const { data: city } = await admin
    .from("places")
    .select("id")
    .eq("type", "city")
    .eq("name", PARENT_CITY_NAME)
    .eq("parent_id", region!.id)
    .single();

  const { data: place, error } = await admin
    .from("places")
    .insert({ type: "campus", name: LOCATION_NAME, parent_id: city!.id, hidden_from_search: true })
    .select("id")
    .single();
  if (error || !place) throw error ?? new Error("Could not create Acme University place");
  console.log(`Created place "${LOCATION_NAME}" (id ${place.id})`);
  return place.id;
}

async function ensureOrganization(locationPlaceId: number): Promise<number> {
  const { data: existing } = await admin.from("organizations").select("id").eq("slug", ORG_SLUG).maybeSingle();
  if (existing) return existing.id;

  const { data: org, error } = await admin
    .from("organizations")
    .insert({
      name: ORG_NAME,
      slug: ORG_SLUG,
      subdomain: ORG_SUBDOMAIN,
      domain: ORG_DOMAIN,
      location_place_id: locationPlaceId,
    })
    .select("id")
    .single();
  if (error || !org) throw error ?? new Error("Could not create organization");
  console.log(`Created organization "${ORG_NAME}" (id ${org.id})`);
  return org.id;
}

async function ensureNetwork(organizationId: number, locationPlaceId: number, seed: LanguageSeed): Promise<number> {
  const { data: language } = await admin.from("languages").select("id").eq("name", seed.languageName).single();
  if (!language) throw new Error(`Language not found: ${seed.languageName}`);

  const { data: existingLink } = await admin
    .from("organization_languages")
    .select("network_id")
    .eq("organization_id", organizationId)
    .eq("language_id", language.id)
    .maybeSingle();
  if (existingLink) return existingLink.network_id;

  const { data: existingNetwork } = await admin
    .from("networks")
    .select("id")
    .eq("language_id", language.id)
    .eq("location_place_id", locationPlaceId)
    .maybeSingle();

  let networkId = existingNetwork?.id;
  if (!networkId) {
    const { data: network, error } = await admin
      .from("networks")
      .insert({ language_id: language.id, location_place_id: locationPlaceId, title: seed.networkTitleSuffix })
      .select("id")
      .single();
    if (error || !network) throw error ?? new Error(`Could not create network for ${seed.languageName}`);
    networkId = network.id;
  }

  const { error: linkError } = await admin
    .from("organization_languages")
    .insert({ organization_id: organizationId, language_id: language.id, network_id: networkId });
  if (linkError) throw linkError;

  console.log(`Linked network "${seed.networkTitleSuffix}" (id ${networkId})`);
  return networkId;
}

async function ensureStudents(networkId: number, seed: LanguageSeed): Promise<string[]> {
  const userIds: string[] = [];
  for (const student of seed.students) {
    const username = `acme_demo_${seed.code}_${student.usernameSuffix}`;
    const { data: existingProfile } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();

    let userId = existingProfile?.id;
    if (!userId) {
      const email = `${username}@example.com`;
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (error?.code === "email_exists") {
        // The auth user survived a previous partial run but its profile
        // update never landed (e.g. a since-fixed grant issue) - recover
        // by finding it instead of failing outright.
        const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
        if (listError) throw listError;
        const match = existingUsers.users.find((u) => u.email === email);
        if (!match) throw error;
        userId = match.id;
      } else if (error || !created.user) {
        throw error ?? new Error(`Could not create fake user ${email}`);
      } else {
        userId = created.user.id;
      }

      const { error: profileError } = await admin
        .from("profiles")
        .update({ username, first_name: student.firstName, last_name: student.lastName, about_me: student.aboutMe })
        .eq("id", userId);
      if (profileError) throw profileError;
      console.log(`  Created fake student ${username}`);
    }

    userIds.push(userId);

    const { data: existingMembership } = await admin
      .from("network_members")
      .select("user_id")
      .eq("network_id", networkId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingMembership) {
      await admin.from("network_members").insert({ network_id: networkId, user_id: userId });
    }
  }
  return userIds;
}

async function ensurePosts(networkId: number, seed: LanguageSeed, studentIds: string[]) {
  const { count } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("network_id", networkId)
    .in("user_id", studentIds);

  if (count && count > 0) {
    console.log(`  Posts already seeded for network ${networkId}, skipping.`);
    return;
  }

  const postIds: number[] = [];
  for (let i = 0; i < seed.posts.length; i++) {
    const authorId = studentIds[i % studentIds.length];
    const { data: post, error } = await admin
      .from("posts")
      .insert({ network_id: networkId, user_id: authorId, body: seed.posts[i] })
      .select("id")
      .single();
    if (error || !post) throw error ?? new Error("Could not create seed post");
    postIds.push(post.id);
  }

  for (const reply of seed.replies) {
    const authorId = studentIds[reply.authorIndex % studentIds.length];
    const { error } = await admin
      .from("post_replies")
      .insert({ post_id: postIds[reply.postIndex], user_id: authorId, body: reply.body });
    if (error) throw error;
  }

  console.log(`  Seeded ${postIds.length} posts and ${seed.replies.length} replies for network ${networkId}`);
}

async function main() {
  const locationPlaceId = await ensurePlace();
  const organizationId = await ensureOrganization(locationPlaceId);

  for (const seed of LANGUAGE_SEEDS) {
    console.log(`\n${seed.languageName}:`);
    const networkId = await ensureNetwork(organizationId, locationPlaceId, seed);
    const studentIds = await ensureStudents(networkId, seed);
    await ensurePosts(networkId, seed, studentIds);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
